import { create } from 'zustand';
import { db } from '../core/db';
import type { Transaction } from '../core/types';
import { newId, now, isScheduled } from '../core/types';
import { getCurrentUserId } from '../auth/useAuthStore';

function sortTransactions(txns: Transaction[]): Transaction[] {
  return txns.slice().sort((a, b) => {
    const aS = isScheduled(a);
    const bS = isScheduled(b);
    if (aS !== bS) return aS ? -1 : 1;
    const dateCmp = b.date.localeCompare(a.date);
    if (dateCmp !== 0) return dateCmp;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

interface TransactionState {
  transactions: Transaction[];
  loading: boolean;
  load: () => Promise<void>;
  add: (data: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Transaction>;
  update: (id: string, data: Partial<Transaction>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  markCompleted: (id: string) => Promise<void>;
}

export const useTransactionStore = create<TransactionState>((set) => ({
  transactions: [],
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      const userId = getCurrentUserId();
      const transactions = await db.transactions.forUser(userId).toArray();
      set({ transactions: sortTransactions(transactions), loading: false });
    } catch {
      set({ loading: false });
    }
  },

  add: async (data) => {
    const userId = getCurrentUserId();
    const txn: Transaction = { id: newId(), createdAt: now(), updatedAt: now(), ...data };
    await db.transactions.forUser(userId).add(txn);
    set((s) => ({
      transactions: sortTransactions([txn, ...s.transactions]),
    }));
    return txn;
  },

  update: async (id, data) => {
    const userId = getCurrentUserId();
    const updated = { ...data, updatedAt: now() };
    await db.transactions.forUser(userId).update(id, updated);
    set((s) => ({
      transactions: sortTransactions(s.transactions.map((t) => (t.id === id ? { ...t, ...updated } : t))),
    }));
  },

  remove: async (id) => {
    const userId = getCurrentUserId();
    await db.transactions.forUser(userId).remove(id);
    set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }));
  },

  markCompleted: async (id) => {
    const userId = getCurrentUserId();
    const today = new Date().toISOString().split('T')[0];
    const completedAt = now();
    const changes = {
      status: 'completed' as const,
      paymentTiming: 'instant' as const,
      date: today,
      completedAt,
      hasFixedScheduleDate: undefined,
      updatedAt: now(),
    };
    await db.transactions.forUser(userId).update(id, changes);
    set((s) => ({
      transactions: sortTransactions(s.transactions.map((t) => (t.id === id ? { ...t, ...changes } : t))),
    }));
  },
}));
