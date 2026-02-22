import { create } from 'zustand';
import { db } from '../core/db';
import type { FinancialGoal } from '../core/types';
import { newId, now } from '../core/types';

interface GoalState {
  goals: FinancialGoal[];
  loading: boolean;
  load: () => Promise<void>;
  add: (data: Omit<FinancialGoal, 'id' | 'createdAt' | 'updatedAt'>) => Promise<FinancialGoal>;
  update: (id: string, data: Partial<FinancialGoal>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useGoalStore = create<GoalState>((set) => ({
  goals: [],
  loading: false,

  load: async () => {
    set({ loading: true });
    const goals = await db.goals.filter((g) => !g.deletedAt).toArray();
    set({ goals, loading: false });
  },

  add: async (data) => {
    const goal: FinancialGoal = {
      id: newId(),
      createdAt: now(),
      updatedAt: now(),
      ...data,
    };
    await db.goals.add(goal);
    set((s) => ({ goals: [...s.goals, goal] }));
    return goal;
  },

  update: async (id, data) => {
    const updated = { ...data, updatedAt: now() };
    await db.goals.update(id, updated);
    set((s) => ({
      goals: s.goals.map((g) => (g.id === id ? { ...g, ...updated } : g)),
    }));
  },

  remove: async (id) => {
    await db.goals.update(id, { deletedAt: now(), updatedAt: now() });
    set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }));
  },
}));
