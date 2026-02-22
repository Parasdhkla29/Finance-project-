import { create } from 'zustand';
import { db } from '../core/db';
import type { Account, AccountType } from '../core/types';
import { newId, now } from '../core/types';

interface AccountState {
  accounts: Account[];
  loading: boolean;
  load: () => Promise<void>;
  add: (data: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Account>;
  update: (id: string, data: Partial<Account>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useAccountStore = create<AccountState>((set, get) => ({
  accounts: [],
  loading: false,

  load: async () => {
    set({ loading: true });
    const accounts = await db.accounts.filter((a) => !a.deletedAt).toArray();
    set({ accounts, loading: false });
  },

  add: async (data) => {
    const account: Account = {
      id: newId(),
      createdAt: now(),
      updatedAt: now(),
      ...data,
    };
    await db.accounts.add(account);
    set((s) => ({ accounts: [...s.accounts, account] }));
    return account;
  },

  update: async (id, data) => {
    const updated = { ...data, updatedAt: now() };
    await db.accounts.update(id, updated);
    set((s) => ({
      accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...updated } : a)),
    }));
  },

  remove: async (id) => {
    await db.accounts.update(id, { deletedAt: now(), updatedAt: now() });
    set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) }));
  },
}));

// Seed a default account if none exist
export async function seedDefaultAccount(): Promise<void> {
  const count = await db.accounts.count();
  if (count === 0) {
    const account: Account = {
      id: newId(),
      name: 'Main Account',
      type: 'checking' as AccountType,
      currency: 'GBP',
      color: '#0ea5e9',
      isArchived: false,
      createdAt: now(),
      updatedAt: now(),
    };
    await db.accounts.add(account);
  }
}
