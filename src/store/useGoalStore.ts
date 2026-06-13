import { create } from 'zustand';
import { db } from '../core/db';
import type { FinancialGoal } from '../core/types';
import { newId, now } from '../core/types';
import { getCurrentUserId } from '../auth/useAuthStore';

interface GoalState {
  goals: FinancialGoal[];
  loading: boolean;
  load: () => Promise<void>;
  add: (data: Omit<FinancialGoal, 'id' | 'createdAt' | 'updatedAt'>) => Promise<FinancialGoal>;
  update: (id: string, data: Partial<FinancialGoal>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Add transaction amount to goal progress. Returns true if goal is now achieved. */
  allocateAmount: (goalId: string, amountMinorUnits: number) => Promise<boolean>;
  /** Reverse a transaction allocation (e.g. on delete). */
  deallocateAmount: (goalId: string, amountMinorUnits: number) => Promise<void>;
}

export const useGoalStore = create<GoalState>((set, get) => ({
  goals: [],
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      const userId = getCurrentUserId();
      const goals = await db.goals.forUser(userId).toArray();
      set({ goals, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  add: async (data) => {
    const userId = getCurrentUserId();
    const goal: FinancialGoal = { id: newId(), createdAt: now(), updatedAt: now(), ...data };
    await db.goals.forUser(userId).add(goal);
    set((s) => ({ goals: [...s.goals, goal] }));
    return goal;
  },

  update: async (id, data) => {
    const updated = { ...data, updatedAt: now() };
    await db.goals.forUser(getCurrentUserId()).update(id, updated);
    set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...updated } : g)) }));
  },

  remove: async (id) => {
    await db.goals.forUser(getCurrentUserId()).update(id, { deletedAt: now(), updatedAt: now() });
    set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }));
  },

  allocateAmount: async (goalId, amountMinorUnits) => {
    const goal = get().goals.find((g) => g.id === goalId);
    if (!goal) return false;
    const newCurrent = goal.currentMinorUnits + amountMinorUnits;
    const isAchieved = newCurrent >= goal.targetMinorUnits;
    const changes: Partial<FinancialGoal> = { currentMinorUnits: newCurrent, isAchieved, updatedAt: now() };
    await db.goals.forUser(getCurrentUserId()).update(goalId, changes);
    set((s) => ({ goals: s.goals.map((g) => g.id === goalId ? { ...g, ...changes } : g) }));
    return isAchieved;
  },

  deallocateAmount: async (goalId, amountMinorUnits) => {
    const goal = get().goals.find((g) => g.id === goalId);
    if (!goal) return;
    const newCurrent = Math.max(0, goal.currentMinorUnits - amountMinorUnits);
    const changes: Partial<FinancialGoal> = {
      currentMinorUnits: newCurrent,
      isAchieved: newCurrent >= goal.targetMinorUnits,
      updatedAt: now(),
    };
    await db.goals.forUser(getCurrentUserId()).update(goalId, changes);
    set((s) => ({ goals: s.goals.map((g) => g.id === goalId ? { ...g, ...changes } : g) }));
  },
}));
