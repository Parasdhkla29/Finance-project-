import { supabase } from '../../core/supabase';
import { getSessionToken } from '../../auth/useAuthStore';

// ── Types ──────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  username: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: 'admin' | 'user';
  status: 'active' | 'disabled';
  tempPasswordRequired: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  transactionCount: number;
  accountCount: number;
}

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  disabledUsers: number;
  totalTransactions: number;
  totalIncome: number;
  totalExpenses: number;
  totalScheduled: number;
  recentActivity: ActivityLog[];
}

export interface ActivityLog {
  id: string;
  adminUsername: string;
  actionType: string;
  targetUsername?: string;
  description?: string;
  createdAt: string;
}

export interface UserDetail {
  user: AdminUser;
  accounts: Record<string, unknown>[];
  transactions: Record<string, unknown>[];
  loans: Record<string, unknown>[];
  subscriptions: Record<string, unknown>[];
  budgets: Record<string, unknown>[];
  goals: Record<string, unknown>[];
  creditCards: Record<string, unknown>[];
}

// ── Internal helpers ───────────────────────────────────────────────────────

type RawUser = {
  id: string;
  username: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  role: 'admin' | 'user';
  status: 'active' | 'disabled';
  temp_password_required: boolean;
  created_at: string;
  updated_at: string;
  last_login_at?: string | null;
  transaction_count: number;
  account_count: number;
};

type RawActivityLog = {
  id: string;
  admin_username: string;
  action_type: string;
  target_username?: string | null;
  description?: string | null;
  created_at: string;
};

type RawDashboardStats = {
  total_users: number;
  active_users: number;
  disabled_users: number;
  total_transactions: number;
  total_income: number;
  total_expenses: number;
  total_scheduled: number;
  recent_activity: RawActivityLog[];
};

type RawUserDetail = {
  user: RawUser;
  accounts: Record<string, unknown>[];
  transactions: Record<string, unknown>[];
  loans: Record<string, unknown>[];
  subscriptions: Record<string, unknown>[];
  budgets: Record<string, unknown>[];
  goals: Record<string, unknown>[];
  credit_cards: Record<string, unknown>[];
};

type MutationResult = {
  success: boolean;
  error?: string;
  user_id?: string;
};

function mapUser(raw: RawUser): AdminUser {
  return {
    id: raw.id,
    username: raw.username,
    fullName: raw.full_name,
    email: raw.email ?? undefined,
    phone: raw.phone ?? undefined,
    role: raw.role,
    status: raw.status,
    tempPasswordRequired: raw.temp_password_required,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    lastLoginAt: raw.last_login_at ?? undefined,
    transactionCount: raw.transaction_count,
    accountCount: raw.account_count,
  };
}

function mapActivityLog(raw: RawActivityLog): ActivityLog {
  return {
    id: raw.id,
    adminUsername: raw.admin_username,
    actionType: raw.action_type,
    targetUsername: raw.target_username ?? undefined,
    description: raw.description ?? undefined,
    createdAt: raw.created_at,
  };
}

// ── API functions ──────────────────────────────────────────────────────────

export async function getUsers(): Promise<AdminUser[]> {
  const p_admin_token = getSessionToken();

  const { data, error } = await supabase.rpc('admin_get_users', { p_admin_token });

  if (error) {
    throw new Error(error.message);
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return (data as RawUser[]).map(mapUser);
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const p_admin_token = getSessionToken();

  const { data, error } = await supabase.rpc('admin_get_dashboard_stats', { p_admin_token });

  if (error) {
    throw new Error(error.message);
  }

  const raw = data as RawDashboardStats;

  return {
    totalUsers: raw.total_users,
    activeUsers: raw.active_users,
    disabledUsers: raw.disabled_users,
    totalTransactions: raw.total_transactions,
    totalIncome: raw.total_income,
    totalExpenses: raw.total_expenses,
    totalScheduled: raw.total_scheduled,
    recentActivity: Array.isArray(raw.recent_activity)
      ? raw.recent_activity.map(mapActivityLog)
      : [],
  };
}

export async function getActivityLogs(limit?: number): Promise<ActivityLog[]> {
  const p_admin_token = getSessionToken();

  const params: { p_admin_token: string; p_limit?: number } = { p_admin_token };
  if (limit !== undefined) {
    params.p_limit = limit;
  }

  const { data, error } = await supabase.rpc('admin_get_activity_logs', params);

  if (error) {
    throw new Error(error.message);
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return (data as RawActivityLog[]).map(mapActivityLog);
}

export async function getUserDetail(userId: string): Promise<UserDetail> {
  const p_admin_token = getSessionToken();

  const { data, error } = await supabase.rpc('admin_get_user_detail', {
    p_admin_token,
    p_user_id: userId,
  });

  if (error) {
    throw new Error(error.message);
  }

  const raw = data as RawUserDetail;

  return {
    user: mapUser(raw.user),
    accounts: raw.accounts ?? [],
    transactions: raw.transactions ?? [],
    loans: raw.loans ?? [],
    subscriptions: raw.subscriptions ?? [],
    budgets: raw.budgets ?? [],
    goals: raw.goals ?? [],
    creditCards: raw.credit_cards ?? [],
  };
}

export async function createUser(params: {
  username: string;
  password: string;
  fullName: string;
  email?: string;
  phone?: string;
  role?: 'admin' | 'user';
}): Promise<{ success: boolean; error?: string; userId?: string }> {
  const p_admin_token = getSessionToken();

  const { data, error } = await supabase.rpc('admin_create_user', {
    p_admin_token,
    p_username: params.username,
    p_password: params.password,
    p_full_name: params.fullName,
    p_email: params.email ?? null,
    p_phone: params.phone ?? null,
    p_role: params.role ?? 'user',
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const result = data as MutationResult;

  if (!result.success) {
    return { success: false, error: result.error ?? 'Failed to create user' };
  }

  return { success: true, userId: result.user_id };
}

export async function updateUser(
  userId: string,
  params: {
    fullName: string;
    email?: string;
    phone?: string;
    status: 'active' | 'disabled';
    role: 'admin' | 'user';
  },
): Promise<{ success: boolean; error?: string }> {
  const p_admin_token = getSessionToken();

  const { data, error } = await supabase.rpc('admin_update_user', {
    p_admin_token,
    p_user_id: userId,
    p_full_name: params.fullName,
    p_email: params.email ?? null,
    p_phone: params.phone ?? null,
    p_status: params.status,
    p_role: params.role,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const result = data as MutationResult;

  if (!result.success) {
    return { success: false, error: result.error ?? 'Failed to update user' };
  }

  return { success: true };
}

export async function resetPassword(
  userId: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  const p_admin_token = getSessionToken();

  const { data, error } = await supabase.rpc('admin_reset_password', {
    p_admin_token,
    p_user_id: userId,
    p_new_password: newPassword,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const result = data as MutationResult;

  if (!result.success) {
    return { success: false, error: result.error ?? 'Failed to reset password' };
  }

  return { success: true };
}

export async function deleteUser(
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const p_admin_token = getSessionToken();

  const { data, error } = await supabase.rpc('admin_delete_user', {
    p_admin_token,
    p_user_id: userId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const result = data as MutationResult;

  if (!result.success) {
    return { success: false, error: result.error ?? 'Failed to delete user' };
  }

  return { success: true };
}
