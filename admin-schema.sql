-- ============================================================
-- Finance App – Admin Schema
-- Run this in the Supabase SQL Editor AFTER the base schema.
-- ============================================================

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  username               TEXT UNIQUE NOT NULL,
  password_hash          TEXT NOT NULL,
  full_name              TEXT NOT NULL,
  email                  TEXT,
  phone                  TEXT,
  role                   TEXT NOT NULL DEFAULT 'user'
                           CHECK (role IN ('admin', 'user')),
  status                 TEXT NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'disabled')),
  temp_password_required BOOLEAN NOT NULL DEFAULT TRUE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at          TIMESTAMPTZ
);

-- ── User Sessions ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_sessions (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token  TEXT UNIQUE NOT NULL,
  device_info    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ,
  revoked_at     TIMESTAMPTZ
);

-- ── Admin Activity Logs ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  admin_id       TEXT NOT NULL,
  action_type    TEXT NOT NULL,
  target_user_id TEXT,
  description    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Add user_id to existing tables ────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounts'        AND column_name='user_id') THEN ALTER TABLE accounts        ADD COLUMN user_id TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions'    AND column_name='user_id') THEN ALTER TABLE transactions    ADD COLUMN user_id TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans'           AND column_name='user_id') THEN ALTER TABLE loans           ADD COLUMN user_id TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscriptions'   AND column_name='user_id') THEN ALTER TABLE subscriptions   ADD COLUMN user_id TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budgets'         AND column_name='user_id') THEN ALTER TABLE budgets         ADD COLUMN user_id TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='goals'           AND column_name='user_id') THEN ALTER TABLE goals           ADD COLUMN user_id TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recurring_rules' AND column_name='user_id') THEN ALTER TABLE recurring_rules ADD COLUMN user_id TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='credit_cards'    AND column_name='user_id') THEN ALTER TABLE credit_cards    ADD COLUMN user_id TEXT; END IF;
END
$$;

-- ── Row Level Security ─────────────────────────────────────────────────────────
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_activity_logs ENABLE ROW LEVEL SECURITY;

-- Drop any existing anon policies on these tables so access is denied by default.
-- All access goes through SECURITY DEFINER RPC functions below.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE tablename IN ('users','user_sessions','admin_activity_logs')
      AND roles::TEXT LIKE '%anon%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END
$$;

-- ── Helper: validate a session and return the user row ─────────────────────────
-- (private, not meant to be called directly)
CREATE OR REPLACE FUNCTION _resolve_session(p_token TEXT)
RETURNS users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session user_sessions;
  v_user    users;
BEGIN
  SELECT * INTO v_session
  FROM user_sessions
  WHERE session_token = p_token
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW());

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_user
  FROM users
  WHERE id = v_session.user_id
    AND status = 'active';

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  UPDATE user_sessions
  SET last_active_at = NOW()
  WHERE id = v_session.id;

  RETURN v_user;
END;
$$;

-- ── RPC: login ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION login(
  p_username    TEXT,
  p_password    TEXT,
  p_device_info TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user          users;
  v_token         TEXT;
  v_session_id    TEXT;
BEGIN
  -- Find user by username
  SELECT * INTO v_user
  FROM users
  WHERE username = p_username;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid username or password');
  END IF;

  -- Check account status
  IF v_user.status <> 'active' THEN
    RETURN json_build_object('success', false, 'error', 'Account is disabled');
  END IF;

  -- Verify password
  IF crypt(p_password, v_user.password_hash) <> v_user.password_hash THEN
    RETURN json_build_object('success', false, 'error', 'Invalid username or password');
  END IF;

  -- Generate session token
  v_token := encode(gen_random_bytes(32), 'hex');
  v_session_id := gen_random_uuid()::TEXT;

  INSERT INTO user_sessions (id, user_id, session_token, device_info)
  VALUES (v_session_id, v_user.id, v_token, p_device_info);

  UPDATE users
  SET last_login_at = NOW()
  WHERE id = v_user.id;

  RETURN json_build_object(
    'success', true,
    'session_token', v_token,
    'user', json_build_object(
      'id',                     v_user.id,
      'username',               v_user.username,
      'full_name',              v_user.full_name,
      'role',                   v_user.role,
      'temp_password_required', v_user.temp_password_required
    )
  );
END;
$$;

-- ── RPC: validate_session ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION validate_session(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user users;
BEGIN
  v_user := _resolve_session(p_token);

  IF v_user IS NULL THEN
    RETURN json_build_object('valid', false);
  END IF;

  RETURN json_build_object(
    'valid', true,
    'user', json_build_object(
      'id',                     v_user.id,
      'username',               v_user.username,
      'full_name',              v_user.full_name,
      'role',                   v_user.role,
      'temp_password_required', v_user.temp_password_required
    )
  );
END;
$$;

-- ── RPC: logout ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION logout(p_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE user_sessions
  SET revoked_at = NOW()
  WHERE session_token = p_token
    AND revoked_at IS NULL;
END;
$$;

-- ── RPC: change_own_password ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION change_own_password(
  p_token        TEXT,
  p_new_password TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user users;
BEGIN
  v_user := _resolve_session(p_token);

  IF v_user IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired session');
  END IF;

  UPDATE users
  SET password_hash          = crypt(p_new_password, gen_salt('bf', 12)),
      temp_password_required = FALSE,
      updated_at             = NOW()
  WHERE id = v_user.id;

  RETURN json_build_object('success', true);
END;
$$;

-- ── RPC: admin_create_user ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_create_user(
  p_admin_token TEXT,
  p_username    TEXT,
  p_password    TEXT,
  p_full_name   TEXT,
  p_email       TEXT DEFAULT NULL,
  p_phone       TEXT DEFAULT NULL,
  p_role        TEXT DEFAULT 'user'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin    users;
  v_new_id   TEXT;
  v_exists   BOOLEAN;
BEGIN
  v_admin := _resolve_session(p_admin_token);

  IF v_admin IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired session');
  END IF;

  IF v_admin.role <> 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'Admin privileges required');
  END IF;

  -- Check username uniqueness
  SELECT EXISTS(SELECT 1 FROM users WHERE username = p_username) INTO v_exists;
  IF v_exists THEN
    RETURN json_build_object('success', false, 'error', 'Username already exists');
  END IF;

  v_new_id := gen_random_uuid()::TEXT;

  INSERT INTO users (id, username, password_hash, full_name, email, phone, role)
  VALUES (
    v_new_id,
    p_username,
    crypt(p_password, gen_salt('bf', 12)),
    p_full_name,
    p_email,
    p_phone,
    p_role
  );

  INSERT INTO admin_activity_logs (admin_id, action_type, target_user_id, description)
  VALUES (v_admin.id, 'create_user', v_new_id,
          format('Created user %s with role %s', p_username, p_role));

  RETURN json_build_object('success', true, 'user_id', v_new_id);
END;
$$;

-- ── RPC: admin_update_user ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_update_user(
  p_admin_token TEXT,
  p_user_id     TEXT,
  p_full_name   TEXT,
  p_email       TEXT,
  p_phone       TEXT,
  p_status      TEXT,
  p_role        TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin      users;
  v_target     users;
BEGIN
  v_admin := _resolve_session(p_admin_token);

  IF v_admin IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired session');
  END IF;

  IF v_admin.role <> 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'Admin privileges required');
  END IF;

  SELECT * INTO v_target FROM users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  UPDATE users
  SET full_name  = p_full_name,
      email      = p_email,
      phone      = p_phone,
      status     = p_status,
      role       = p_role,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Revoke all sessions if the account is being disabled
  IF p_status = 'disabled' AND v_target.status = 'active' THEN
    UPDATE user_sessions
    SET revoked_at = NOW()
    WHERE user_id = p_user_id
      AND revoked_at IS NULL;
  END IF;

  INSERT INTO admin_activity_logs (admin_id, action_type, target_user_id, description)
  VALUES (v_admin.id, 'update_user', p_user_id,
          format('Updated user %s (status=%s, role=%s)', v_target.username, p_status, p_role));

  RETURN json_build_object('success', true);
END;
$$;

-- ── RPC: admin_reset_password ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_reset_password(
  p_admin_token  TEXT,
  p_user_id      TEXT,
  p_new_password TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin  users;
  v_target users;
BEGIN
  v_admin := _resolve_session(p_admin_token);

  IF v_admin IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired session');
  END IF;

  IF v_admin.role <> 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'Admin privileges required');
  END IF;

  SELECT * INTO v_target FROM users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  UPDATE users
  SET password_hash          = crypt(p_new_password, gen_salt('bf', 12)),
      temp_password_required = TRUE,
      updated_at             = NOW()
  WHERE id = p_user_id;

  -- Revoke all active sessions so the user must log in again with the new password
  UPDATE user_sessions
  SET revoked_at = NOW()
  WHERE user_id = p_user_id
    AND revoked_at IS NULL;

  INSERT INTO admin_activity_logs (admin_id, action_type, target_user_id, description)
  VALUES (v_admin.id, 'reset_password', p_user_id,
          format('Reset password for user %s', v_target.username));

  RETURN json_build_object('success', true);
END;
$$;

-- ── RPC: admin_delete_user ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_delete_user(
  p_admin_token TEXT,
  p_user_id     TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin  users;
  v_target users;
BEGIN
  v_admin := _resolve_session(p_admin_token);

  IF v_admin IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired session');
  END IF;

  IF v_admin.role <> 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'Admin privileges required');
  END IF;

  -- Prevent self-deletion
  IF v_admin.id = p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot delete your own account');
  END IF;

  SELECT * INTO v_target FROM users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Log before deletion so the FK reference is still valid
  INSERT INTO admin_activity_logs (admin_id, action_type, target_user_id, description)
  VALUES (v_admin.id, 'delete_user', p_user_id,
          format('Deleted user %s', v_target.username));

  DELETE FROM users WHERE id = p_user_id;

  RETURN json_build_object('success', true);
END;
$$;

-- ── RPC: admin_get_users ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_users(p_admin_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin users;
BEGIN
  v_admin := _resolve_session(p_admin_token);

  IF v_admin IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired session');
  END IF;

  IF v_admin.role <> 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'Admin privileges required');
  END IF;

  RETURN (
    SELECT json_agg(row_to_json(q))
    FROM (
      SELECT
        u.id,
        u.username,
        u.full_name,
        u.email,
        u.phone,
        u.role,
        u.status,
        u.temp_password_required,
        u.created_at,
        u.updated_at,
        u.last_login_at,
        (SELECT COUNT(*) FROM transactions t
          WHERE t.user_id = u.id AND t.deleted_at IS NULL) AS transaction_count,
        (SELECT COUNT(*) FROM accounts a
          WHERE a.user_id = u.id AND a.deleted_at IS NULL) AS account_count
      FROM users u
      ORDER BY u.created_at DESC
    ) q
  );
END;
$$;

-- ── RPC: admin_get_user_detail ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_user_detail(
  p_admin_token TEXT,
  p_user_id     TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin  users;
  v_target users;
BEGIN
  v_admin := _resolve_session(p_admin_token);

  IF v_admin IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired session');
  END IF;

  IF v_admin.role <> 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'Admin privileges required');
  END IF;

  SELECT * INTO v_target FROM users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  RETURN json_build_object(
    'success', true,
    'user', row_to_json(v_target),
    'accounts', (
      SELECT COALESCE(json_agg(row_to_json(a)), '[]'::json)
      FROM accounts a
      WHERE a.user_id = p_user_id AND a.deleted_at IS NULL
    ),
    'transactions', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT * FROM transactions
        WHERE user_id = p_user_id AND deleted_at IS NULL
        ORDER BY date DESC
        LIMIT 200
      ) t
    ),
    'loans', (
      SELECT COALESCE(json_agg(row_to_json(l)), '[]'::json)
      FROM loans l
      WHERE l.user_id = p_user_id AND l.deleted_at IS NULL
    ),
    'subscriptions', (
      SELECT COALESCE(json_agg(row_to_json(s)), '[]'::json)
      FROM subscriptions s
      WHERE s.user_id = p_user_id AND s.deleted_at IS NULL
    ),
    'budgets', (
      SELECT COALESCE(json_agg(row_to_json(b)), '[]'::json)
      FROM budgets b
      WHERE b.user_id = p_user_id AND b.deleted_at IS NULL
    ),
    'goals', (
      SELECT COALESCE(json_agg(row_to_json(g)), '[]'::json)
      FROM goals g
      WHERE g.user_id = p_user_id AND g.deleted_at IS NULL
    ),
    'credit_cards', (
      SELECT COALESCE(json_agg(row_to_json(c)), '[]'::json)
      FROM credit_cards c
      WHERE c.user_id = p_user_id AND c.deleted_at IS NULL
    )
  );
END;
$$;

-- ── RPC: admin_get_dashboard_stats ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_dashboard_stats(p_admin_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin          users;
  v_total_users    BIGINT;
  v_active_users   BIGINT;
  v_disabled_users BIGINT;
  v_total_txns     BIGINT;
  v_total_income   BIGINT;
  v_total_expenses BIGINT;
  v_total_sched    BIGINT;
BEGIN
  v_admin := _resolve_session(p_admin_token);

  IF v_admin IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired session');
  END IF;

  IF v_admin.role <> 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'Admin privileges required');
  END IF;

  SELECT COUNT(*)                              INTO v_total_users    FROM users;
  SELECT COUNT(*) FILTER (WHERE status='active')   INTO v_active_users   FROM users;
  SELECT COUNT(*) FILTER (WHERE status='disabled') INTO v_disabled_users FROM users;

  SELECT
    COUNT(*),
    COALESCE(SUM(amount_minor_units) FILTER (WHERE type = 'income'),  0),
    COALESCE(SUM(amount_minor_units) FILTER (WHERE type = 'expense'), 0),
    COUNT(*) FILTER (WHERE status = 'scheduled')
  INTO v_total_txns, v_total_income, v_total_expenses, v_total_sched
  FROM transactions
  WHERE deleted_at IS NULL;

  RETURN json_build_object(
    'success',          true,
    'total_users',      v_total_users,
    'active_users',     v_active_users,
    'disabled_users',   v_disabled_users,
    'total_transactions', v_total_txns,
    'total_income',     v_total_income,
    'total_expenses',   v_total_expenses,
    'total_scheduled',  v_total_sched,
    'recent_activity', (
      SELECT COALESCE(json_agg(row_to_json(q)), '[]'::json)
      FROM (
        SELECT
          l.id,
          l.action_type,
          l.description,
          l.created_at,
          (SELECT username FROM users WHERE id = l.admin_id)         AS admin_username,
          (SELECT username FROM users WHERE id = l.target_user_id)   AS target_username
        FROM admin_activity_logs l
        ORDER BY l.created_at DESC
        LIMIT 10
      ) q
    )
  );
END;
$$;

-- ── RPC: admin_get_activity_logs ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_activity_logs(
  p_admin_token TEXT,
  p_limit       INT DEFAULT 100
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin users;
BEGIN
  v_admin := _resolve_session(p_admin_token);

  IF v_admin IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired session');
  END IF;

  IF v_admin.role <> 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'Admin privileges required');
  END IF;

  RETURN (
    SELECT COALESCE(json_agg(row_to_json(q)), '[]'::json)
    FROM (
      SELECT
        l.id,
        l.admin_id,
        l.action_type,
        l.target_user_id,
        l.description,
        l.created_at,
        (SELECT username FROM users WHERE id = l.admin_id)         AS admin_username,
        (SELECT username FROM users WHERE id = l.target_user_id)   AS target_username
      FROM admin_activity_logs l
      ORDER BY l.created_at DESC
      LIMIT p_limit
    ) q
  );
END;
$$;

-- ── Bootstrap: first admin user ────────────────────────────────────────────────
-- Uncomment and run once to create the initial admin account.
-- Change the password immediately after first login.
--
-- INSERT INTO users (username, password_hash, full_name, role, temp_password_required)
-- VALUES (
--   'admin',
--   crypt('Admin@123', gen_salt('bf', 12)),
--   'System Admin',
--   'admin',
--   FALSE
-- )
-- ON CONFLICT (username) DO NOTHING;
