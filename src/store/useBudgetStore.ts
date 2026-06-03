import { create } from 'zustand';
import { db } from '../core/db';
import type { Budget } from '../core/types';
import { newId, now } from '../core/types';
import { getCurrentUserId } from '../auth/useAuthStore';

interface BudgetState {
  budgets: Budget[];
  loading: boolean;
  load: () => Promise<void>;
  add: (data: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Budget>;
  update: (id: string, data: Partial<Budget>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useBudgetStore = create<BudgetState>((set) => ({
  budgets: [],
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      const userId = getCurrentUserId();
      const budgets = await db.budgets.forUser(userId).toArray();
      set({ budgets, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  add: async (data) => {
    const userId = getCurrentUserId();
    const budget: Budget = { id: newId(), createdAt: now(), updatedAt: now(), ...data };
    await db.budgets.forUser(userId).add(budget);
    set((s) => ({ budgets: [...s.budgets, budget] }));
    return budget;
  },

  update: async (id, data) => {
    const updated = { ...data, updatedAt: now() };
    await db.budgets.forUser(getCurrentUserId()).update(id, updated);
    set((s) => ({ budgets: s.budgets.map((b) => (b.id === id ? { ...b, ...updated } : b)) }));
  },

  remove: async (id) => {
    await db.budgets.forUser(getCurrentUserId()).update(id, { deletedAt: now(), updatedAt: now() });
    set((s) => ({ budgets: s.budgets.filter((b) => b.id !== id) }));
  },
}));
