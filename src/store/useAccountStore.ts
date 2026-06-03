import { create } from 'zustand';
import { db } from '../core/db';
import type { Account, AccountType } from '../core/types';
import { newId, now } from '../core/types';
import { getCurrentUserId } from '../auth/useAuthStore';

interface AccountState {
  accounts: Account[];
  loading: boolean;
  load: () => Promise<void>;
  add: (data: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Account>;
  update: (id: string, data: Partial<Account>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useAccountStore = create<AccountState>((set) => ({
  accounts: [],
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      const userId = getCurrentUserId();
      const accounts = await db.accounts.forUser(userId).toArray();
      set({ accounts, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  add: async (data) => {
    const userId = getCurrentUserId();
    const account: Account = {
      id: newId(),
      createdAt: now(),
      updatedAt: now(),
      ...data,
    };
    await db.accounts.forUser(userId).add(account);
    set((s) => ({ accounts: [...s.accounts, account] }));
    return account;
  },

  update: async (id, data) => {
    const userId = getCurrentUserId();
    const updated = { ...data, updatedAt: now() };
    await db.accounts.forUser(userId).update(id, updated);
    set((s) => ({
      accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...updated } : a)),
    }));
  },

  remove: async (id) => {
    const userId = getCurrentUserId();
    await db.accounts.forUser(userId).remove(id);
    set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) }));
  },
}));

// Seed a default account for the current user if they have none
export async function seedDefaultAccount(): Promise<void> {
  try {
    const userId = getCurrentUserId();
    const count = await db.accounts.forUser(userId).count();
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
      await db.accounts.forUser(userId).add(account);
    }
  } catch {
    // Not yet authenticated — skip seeding
  }
}
