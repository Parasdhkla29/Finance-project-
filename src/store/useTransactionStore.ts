import { create } from 'zustand';
import { db } from '../core/db';
import type { Transaction } from '../core/types';
import { newId, now } from '../core/types';

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
    const transactions = await db.transactions
      .filter((t) => !t.deletedAt)
      .toArray();
    // Sort descending by date
    transactions.sort((a, b) => b.date.localeCompare(a.date));
    set({ transactions, loading: false });
  },

  add: async (data) => {
    const txn: Transaction = {
      id: newId(),
      createdAt: now(),
      updatedAt: now(),
      ...data,
    };
    await db.transactions.add(txn);
    set((s) => ({
      transactions: [txn, ...s.transactions].sort((a, b) => b.date.localeCompare(a.date)),
    }));
    return txn;
  },

  update: async (id, data) => {
    const updated = { ...data, updatedAt: now() };
    await db.transactions.update(id, updated);
    set((s) => ({
      transactions: s.transactions
        .map((t) => (t.id === id ? { ...t, ...updated } : t))
        .sort((a, b) => b.date.localeCompare(a.date)),
    }));
  },

  remove: async (id) => {
    await db.transactions.update(id, { deletedAt: now(), updatedAt: now() });
    set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }));
  },

  markCompleted: async (id) => {
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
    await db.transactions.update(id, changes);
    set((s) => ({
      transactions: s.transactions
        .map((t) => (t.id === id ? { ...t, ...changes } : t))
        .sort((a, b) => b.date.localeCompare(a.date)),
    }));
  },
}));
