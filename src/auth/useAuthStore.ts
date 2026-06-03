import { create } from 'zustand';
import { supabase } from '../core/supabase';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  role: 'admin' | 'user';
  tempPasswordRequired: boolean;
}

// Shape returned by the login / validate_session RPCs (snake_case from Postgres)
interface RpcUser {
  id: string;
  username: string;
  full_name: string;
  role: 'admin' | 'user';
  temp_password_required: boolean;
}

interface LoginRpcResult {
  success: boolean;
  error?: string;
  session_token?: string;
  user?: RpcUser;
}

interface ValidateSessionRpcResult {
  valid: boolean;
  user?: RpcUser;
}

interface GenericRpcResult {
  success: boolean;
  error?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const SESSION_KEY = 'pl_session_token';

function mapRpcUser(u: RpcUser): AuthUser {
  return {
    id:                   u.id,
    username:             u.username,
    fullName:             u.full_name,
    role:                 u.role,
    tempPasswordRequired: u.temp_password_required,
  };
}

// ── Store interface ────────────────────────────────────────────────────────────

interface AuthState {
  user:         AuthUser | null;
  sessionToken: string | null;
  loading:      boolean;
  initialized:  boolean;
}

interface AuthActions {
  initSession:     () => Promise<void>;
  login:           (username: string, password: string) => Promise<{ success: boolean; error?: string; user?: AuthUser }>;
  logout:          () => Promise<void>;
  changePassword:  (newPassword: string) => Promise<{ success: boolean; error?: string }>;
}

// ── Store ──────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  // ── State ──────────────────────────────────────────────────────────────────
  user:         null,
  sessionToken: null,
  loading:      false,
  initialized:  false,

  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * Called once on app startup. Reads the stored session token and validates it
   * against the database. If the session is no longer valid the token is removed.
   */
  initSession: async () => {
    set({ loading: true });

    try {
      const token = localStorage.getItem(SESSION_KEY);

      if (!token) {
        set({ initialized: true, loading: false });
        return;
      }

      const { data, error } = await supabase.rpc('validate_session', {
        p_token: token,
      });

      if (error) {
        console.error('[Auth] validate_session error:', error.message);
        localStorage.removeItem(SESSION_KEY);
        set({ user: null, sessionToken: null, initialized: true, loading: false });
        return;
      }

      const result = data as ValidateSessionRpcResult;

      if (result?.valid && result.user) {
        set({
          user:         mapRpcUser(result.user),
          sessionToken: token,
          initialized:  true,
          loading:      false,
        });
      } else {
        localStorage.removeItem(SESSION_KEY);
        set({ user: null, sessionToken: null, initialized: true, loading: false });
      }
    } catch (err) {
      console.error('[Auth] initSession unexpected error:', err);
      localStorage.removeItem(SESSION_KEY);
      set({ user: null, sessionToken: null, initialized: true, loading: false });
    }
  },

  /**
   * Authenticates the user with username + password.
   * On success, persists the session token to localStorage and updates the store.
   */
  login: async (username, password) => {
    set({ loading: true });

    try {
      const { data, error } = await supabase.rpc('login', {
        p_username:    username,
        p_password:    password,
        p_device_info: navigator.userAgent,
      });

      if (error) {
        set({ loading: false });
        return { success: false, error: error.message };
      }

      const result = data as LoginRpcResult;

      if (!result?.success || !result.session_token || !result.user) {
        set({ loading: false });
        return { success: false, error: result?.error ?? 'Login failed' };
      }

      const authUser = mapRpcUser(result.user);

      localStorage.setItem(SESSION_KEY, result.session_token);

      set({
        user:         authUser,
        sessionToken: result.session_token,
        loading:      false,
      });

      return { success: true, user: authUser };
    } catch (err) {
      console.error('[Auth] login unexpected error:', err);
      set({ loading: false });
      return { success: false, error: 'An unexpected error occurred' };
    }
  },

  /**
   * Revokes the current session on the server and clears local state.
   */
  logout: async () => {
    const token = get().sessionToken ?? localStorage.getItem(SESSION_KEY);

    // Clear local state immediately so the UI responds without waiting
    localStorage.removeItem(SESSION_KEY);
    set({ user: null, sessionToken: null, loading: false });

    if (token) {
      try {
        await supabase.rpc('logout', { p_token: token });
      } catch (err) {
        // Best-effort: the session is already cleared locally
        console.warn('[Auth] logout RPC error (ignored):', err);
      }
    }
  },

  /**
   * Changes the authenticated user's password.
   * On success, clears the tempPasswordRequired flag in the store.
   */
  changePassword: async (newPassword) => {
    const token = get().sessionToken;

    if (!token) {
      return { success: false, error: 'No active session' };
    }

    try {
      const { data, error } = await supabase.rpc('change_own_password', {
        p_token:        token,
        p_new_password: newPassword,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const result = data as GenericRpcResult;

      if (!result?.success) {
        return { success: false, error: result?.error ?? 'Password change failed' };
      }

      // Reflect the change in the store so consumers re-render
      set((state) => ({
        user: state.user
          ? { ...state.user, tempPasswordRequired: false }
          : null,
      }));

      return { success: true };
    } catch (err) {
      console.error('[Auth] changePassword unexpected error:', err);
      return { success: false, error: 'An unexpected error occurred' };
    }
  },
}));

// ── Standalone helpers ─────────────────────────────────────────────────────────

/**
 * Returns the current user's ID.
 * Throws if the user is not authenticated — use only in authenticated contexts.
 */
export function getCurrentUserId(): string {
  const id = useAuthStore.getState().user?.id;
  if (!id) throw new Error('[Auth] No authenticated user — getCurrentUserId() called without a session');
  return id;
}

/**
 * Returns the current session token.
 * Throws if there is no active session — use only in authenticated contexts.
 */
export function getSessionToken(): string {
  const token = useAuthStore.getState().sessionToken;
  if (!token) throw new Error('[Auth] No active session — getSessionToken() called without a session');
  return token;
}
