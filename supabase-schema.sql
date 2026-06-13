-- ============================================================
-- Finance App – Supabase PostgreSQL Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ── Accounts ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'GBP',
  color           TEXT NOT NULL DEFAULT '#0ea5e9',
  is_archived     BOOLEAN NOT NULL DEFAULT FALSE,
  notes           TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  deleted_at      TEXT
);

-- ── Transactions ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id                      TEXT PRIMARY KEY,
  account_id              TEXT NOT NULL,
  to_account_id           TEXT,
  type                    TEXT NOT NULL,
  amount_minor_units      BIGINT NOT NULL DEFAULT 0,
  currency                TEXT NOT NULL DEFAULT 'GBP',
  category                TEXT NOT NULL DEFAULT '',
  subcategory             TEXT,
  merchant                TEXT,
  notes                   TEXT,
  date                    TEXT NOT NULL,
  payment_method          TEXT,
  payment_timing          TEXT,
  status                  TEXT,
  has_fixed_schedule_date BOOLEAN,
  completed_at            TEXT,
  tags                    TEXT[] NOT NULL DEFAULT '{}',
  is_recurring            BOOLEAN NOT NULL DEFAULT FALSE,
  recurring_id            TEXT,
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  deleted_at              TEXT
);

-- ── Loans ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loans (
  id                      TEXT PRIMARY KEY,
  direction               TEXT NOT NULL,
  counterparty            TEXT NOT NULL,
  principal_minor_units   BIGINT NOT NULL DEFAULT 0,
  currency                TEXT NOT NULL DEFAULT 'GBP',
  remaining_minor_units   BIGINT NOT NULL DEFAULT 0,
  interest_rate           NUMERIC(8,4),
  start_date              TEXT NOT NULL,
  due_date                TEXT,
  status                  TEXT NOT NULL DEFAULT 'active',
  notes                   TEXT,
  payments                JSONB NOT NULL DEFAULT '[]',
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  deleted_at              TEXT
);

-- ── Subscriptions ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  amount_minor_units  BIGINT NOT NULL DEFAULT 0,
  currency            TEXT NOT NULL DEFAULT 'GBP',
  billing_cycle       TEXT NOT NULL DEFAULT 'monthly',
  next_billing_date   TEXT NOT NULL,
  category            TEXT NOT NULL DEFAULT '',
  account_id          TEXT,
  url                 TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  notes               TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  deleted_at          TEXT
);

-- ── Budgets ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budgets (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  category            TEXT NOT NULL,
  amount_minor_units  BIGINT NOT NULL DEFAULT 0,
  period              TEXT NOT NULL DEFAULT 'monthly',
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  deleted_at          TEXT
);

-- ── Financial Goals ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goals (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  target_minor_units    BIGINT NOT NULL DEFAULT 0,
  current_minor_units   BIGINT NOT NULL DEFAULT 0,
  currency              TEXT NOT NULL DEFAULT 'GBP',
  target_date           TEXT,
  category              TEXT NOT NULL DEFAULT 'custom',
  notes                 TEXT,
  is_achieved           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  deleted_at            TEXT
);

-- ── Recurring Rules ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recurring_rules (
  id                          TEXT PRIMARY KEY,
  template_account_id         TEXT NOT NULL,
  template_type               TEXT NOT NULL,
  template_amount_minor_units BIGINT NOT NULL DEFAULT 0,
  template_currency           TEXT NOT NULL DEFAULT 'GBP',
  template_category           TEXT NOT NULL DEFAULT '',
  template_merchant           TEXT,
  template_notes              TEXT,
  frequency                   TEXT NOT NULL DEFAULT 'monthly',
  start_date                  TEXT NOT NULL,
  end_date                    TEXT,
  last_generated_date         TEXT,
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                  TEXT NOT NULL,
  updated_at                  TEXT NOT NULL,
  deleted_at                  TEXT
);

-- ── Credit Cards ───────────────────────────────────────────
-- 'transactions' column holds a JSONB array of CreditCardTransaction objects
CREATE TABLE IF NOT EXISTS credit_cards (
  id                      TEXT PRIMARY KEY,
  name                    TEXT NOT NULL,
  last4                   TEXT NOT NULL DEFAULT '0000',
  expiry                  TEXT NOT NULL DEFAULT '01/30',
  network                 TEXT NOT NULL DEFAULT 'visa',
  limit_minor_units       BIGINT NOT NULL DEFAULT 0,
  balance_minor_units     BIGINT NOT NULL DEFAULT 0,
  min_payment_minor_units BIGINT NOT NULL DEFAULT 0,
  due_date                TEXT NOT NULL,
  apr                     NUMERIC(8,4) NOT NULL DEFAULT 0,
  cashback_minor_units    BIGINT NOT NULL DEFAULT 0,
  status                  TEXT NOT NULL DEFAULT 'active',
  color                   TEXT NOT NULL DEFAULT '#0ea5e9',
  currency                TEXT NOT NULL DEFAULT 'GBP',
  notes                   TEXT,
  transactions            JSONB NOT NULL DEFAULT '[]',
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  deleted_at              TEXT
);

-- ── Row Level Security ─────────────────────────────────────
-- Enable RLS on all tables, then add a permissive policy for the
-- anonymous role so the app can read/write without authentication.
-- This is appropriate for a personal single-user app.

ALTER TABLE accounts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans           ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_cards    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON accounts        FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON transactions    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON loans           FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON subscriptions   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON budgets         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON goals           FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON recurring_rules FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON credit_cards    FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── Migrations (run if upgrading an existing DB) ───────────────────────────
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS received_at TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS received_amount_minor_units BIGINT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS partial_payments JSONB NOT NULL DEFAULT '[]';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS allocation_type TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS linked_goal_id TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS linked_entity_name TEXT;
