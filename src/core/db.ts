/**
 * Supabase-backed database shim.
 * Exposes the same table API that stores and other modules expect,
 * but delegates all persistence to Supabase instead of Dexie/IndexedDB.
 */
import { supabase, toDb, fromDb, fromDbArray } from './supabase';
import type {
  Account,
  Transaction,
  Loan,
  Subscription,
  Budget,
  FinancialGoal,
  RecurringRule,
  CreditCard,
} from './types';

// ── Generic table wrapper ──────────────────────────────────────────────────

class SupabaseTable<T extends { id: string }> {
  private tableName: string;
  constructor(tableName: string) {
    this.tableName = tableName;
  }

  async toArray(): Promise<T[]> {
    const { data, error } = await supabase.from(this.tableName).select('*');
    if (error) throw new Error(`[DB] ${this.tableName}.toArray: ${error.message}`);
    return fromDbArray<T>((data ?? []) as Record<string, unknown>[]);
  }

  filter(fn: (item: T) => boolean): FilteredTable<T> {
    return new FilteredTable<T>(this.tableName, fn);
  }

  async add(obj: T): Promise<void> {
    const { error } = await supabase
      .from(this.tableName)
      .insert(toDb(obj as unknown as Record<string, unknown>));
    if (error) throw new Error(`[DB] ${this.tableName}.add: ${error.message}`);
  }

  async update(id: string, changes: Partial<T>): Promise<void> {
    const snakeChanges = toDb(changes as unknown as Record<string, unknown>);
    const { error } = await supabase
      .from(this.tableName)
      .update(snakeChanges)
      .eq('id', id);
    if (error) throw new Error(`[DB] ${this.tableName}.update: ${error.message}`);
  }

  async bulkAdd(objs: T[]): Promise<void> {
    if (objs.length === 0) return;
    const { error } = await supabase
      .from(this.tableName)
      .insert(objs.map((o) => toDb(o as unknown as Record<string, unknown>)));
    if (error) throw new Error(`[DB] ${this.tableName}.bulkAdd: ${error.message}`);
  }

  async bulkPut(objs: T[]): Promise<void> {
    if (objs.length === 0) return;
    const { error } = await supabase
      .from(this.tableName)
      .upsert(objs.map((o) => toDb(o as unknown as Record<string, unknown>)));
    if (error) throw new Error(`[DB] ${this.tableName}.bulkPut: ${error.message}`);
  }

  async count(): Promise<number> {
    const { count, error } = await supabase
      .from(this.tableName)
      .select('*', { count: 'exact', head: true });
    if (error) throw new Error(`[DB] ${this.tableName}.count: ${error.message}`);
    return count ?? 0;
  }

  async clear(): Promise<void> {
    const { error } = await supabase
      .from(this.tableName)
      .delete()
      .neq('id', '');
    if (error) throw new Error(`[DB] ${this.tableName}.clear: ${error.message}`);
  }

  forUser(userId: string): UserScopedTable<T> {
    return new UserScopedTable<T>(this.tableName, userId);
  }
}

// ── User-scoped table (server-side user_id filter) ──────────────────────────

class UserScopedTable<T extends { id: string }> {
  private tableName: string;
  private userId: string;
  constructor(tableName: string, userId: string) {
    this.tableName = tableName;
    this.userId = userId;
  }

  async toArray(): Promise<T[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', this.userId)
      .is('deleted_at', null);
    if (error) throw new Error(`[DB] ${this.tableName}.forUser.toArray: ${error.message}`);
    return fromDbArray<T>((data ?? []) as Record<string, unknown>[]);
  }

  async add(obj: T): Promise<void> {
    const dbObj = toDb(obj as unknown as Record<string, unknown>);
    dbObj['user_id'] = this.userId;
    const { error } = await supabase.from(this.tableName).insert(dbObj);
    if (error) throw new Error(`[DB] ${this.tableName}.forUser.add: ${error.message}`);
  }

  async count(): Promise<number> {
    const { count, error } = await supabase
      .from(this.tableName)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', this.userId)
      .is('deleted_at', null);
    if (error) throw new Error(`[DB] ${this.tableName}.forUser.count: ${error.message}`);
    return count ?? 0;
  }
}

// ── Filtered-table proxy (client-side filter, mirrors Dexie behaviour) ──────

class FilteredTable<T> {
  private tableName: string;
  private fn: (item: T) => boolean;
  constructor(tableName: string, fn: (item: T) => boolean) {
    this.tableName = tableName;
    this.fn = fn;
  }

  async toArray(): Promise<T[]> {
    const { data, error } = await supabase.from(this.tableName).select('*');
    if (error) throw new Error(`[DB] ${this.tableName}.filter.toArray: ${error.message}`);
    return fromDbArray<T>((data ?? []) as Record<string, unknown>[]).filter(this.fn);
  }

  async count(): Promise<number> {
    return (await this.toArray()).length;
  }
}

// ── DB instance (drop-in replacement for the old Dexie db) ─────────────────

export const db = {
  accounts:       new SupabaseTable<Account>('accounts'),
  transactions:   new SupabaseTable<Transaction>('transactions'),
  loans:          new SupabaseTable<Loan>('loans'),
  subscriptions:  new SupabaseTable<Subscription>('subscriptions'),
  budgets:        new SupabaseTable<Budget>('budgets'),
  goals:          new SupabaseTable<FinancialGoal>('goals'),
  recurringRules: new SupabaseTable<RecurringRule>('recurring_rules'),
  creditCards:    new SupabaseTable<CreditCard>('credit_cards'),

  /** No-op wrapper — Supabase JS doesn't support client-side transactions.
   *  Each individual operation is atomic on the server side. */
  transaction: async (
    _mode: string,
    _tables: unknown[],
    fn: () => Promise<void>,
  ): Promise<void> => {
    await fn();
  },
};

/** Keep for any code that imports this helper directly from db.ts */
export function active<T extends { deletedAt?: string }>(records: T[]): T[] {
  return records.filter((r) => !r.deletedAt);
}
