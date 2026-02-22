import { create } from 'zustand';
import { db } from '../core/db';
import type { Subscription } from '../core/types';
import { newId, now } from '../core/types';

interface SubscriptionState {
  subscriptions: Subscription[];
  loading: boolean;
  load: () => Promise<void>;
  add: (data: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Subscription>;
  update: (id: string, data: Partial<Subscription>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  subscriptions: [],
  loading: false,

  load: async () => {
    set({ loading: true });
    const subscriptions = await db.subscriptions.filter((s) => !s.deletedAt).toArray();
    subscriptions.sort((a, b) => a.nextBillingDate.localeCompare(b.nextBillingDate));
    set({ subscriptions, loading: false });
  },

  add: async (data) => {
    const sub: Subscription = {
      id: newId(),
      createdAt: now(),
      updatedAt: now(),
      ...data,
    };
    await db.subscriptions.add(sub);
    set((s) => ({ subscriptions: [...s.subscriptions, sub] }));
    return sub;
  },

  update: async (id, data) => {
    const updated = { ...data, updatedAt: now() };
    await db.subscriptions.update(id, updated);
    set((s) => ({
      subscriptions: s.subscriptions.map((sub) =>
        sub.id === id ? { ...sub, ...updated } : sub,
      ),
    }));
  },

  remove: async (id) => {
    await db.subscriptions.update(id, { deletedAt: now(), updatedAt: now() });
    set((s) => ({ subscriptions: s.subscriptions.filter((sub) => sub.id !== id) }));
  },
}));
