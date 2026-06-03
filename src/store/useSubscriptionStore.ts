import { create } from 'zustand';
import { db } from '../core/db';
import type { Subscription } from '../core/types';
import { newId, now } from '../core/types';
import { getCurrentUserId } from '../auth/useAuthStore';

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
    try {
      const userId = getCurrentUserId();
      const subscriptions = await db.subscriptions.forUser(userId).toArray();
      subscriptions.sort((a, b) => a.nextBillingDate.localeCompare(b.nextBillingDate));
      set({ subscriptions, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  add: async (data) => {
    const userId = getCurrentUserId();
    const sub: Subscription = { id: newId(), createdAt: now(), updatedAt: now(), ...data };
    await db.subscriptions.forUser(userId).add(sub);
    set((s) => ({ subscriptions: [...s.subscriptions, sub] }));
    return sub;
  },

  update: async (id, data) => {
    const updated = { ...data, updatedAt: now() };
    await db.subscriptions.update(id, updated);
    set((s) => ({ subscriptions: s.subscriptions.map((sub) => (sub.id === id ? { ...sub, ...updated } : sub)) }));
  },

  remove: async (id) => {
    await db.subscriptions.update(id, { deletedAt: now(), updatedAt: now() });
    set((s) => ({ subscriptions: s.subscriptions.filter((sub) => sub.id !== id) }));
  },
}));
