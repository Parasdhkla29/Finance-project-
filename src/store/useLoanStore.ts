import { create } from 'zustand';
import { db } from '../core/db';
import type { Loan, LoanPayment } from '../core/types';
import { newId, now } from '../core/types';

interface LoanState {
  loans: Loan[];
  loading: boolean;
  load: () => Promise<void>;
  add: (data: Omit<Loan, 'id' | 'createdAt' | 'updatedAt' | 'payments'>) => Promise<Loan>;
  update: (id: string, data: Partial<Loan>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  addPayment: (loanId: string, payment: Omit<LoanPayment, 'id'>) => Promise<void>;
}

export const useLoanStore = create<LoanState>((set, get) => ({
  loans: [],
  loading: false,

  load: async () => {
    set({ loading: true });
    const loans = await db.loans.filter((l) => !l.deletedAt).toArray();
    loans.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    set({ loans, loading: false });
  },

  add: async (data) => {
    const loan: Loan = {
      id: newId(),
      createdAt: now(),
      updatedAt: now(),
      payments: [],
      ...data,
    };
    await db.loans.add(loan);
    set((s) => ({ loans: [loan, ...s.loans] }));
    return loan;
  },

  update: async (id, data) => {
    const updated = { ...data, updatedAt: now() };
    await db.loans.update(id, updated);
    set((s) => ({
      loans: s.loans.map((l) => (l.id === id ? { ...l, ...updated } : l)),
    }));
  },

  remove: async (id) => {
    await db.loans.update(id, { deletedAt: now(), updatedAt: now() });
    set((s) => ({ loans: s.loans.filter((l) => l.id !== id) }));
  },

  addPayment: async (loanId, paymentData) => {
    const { loans } = get();
    const loan = loans.find((l) => l.id === loanId);
    if (!loan) return;

    const payment: LoanPayment = { id: newId(), ...paymentData };
    const newRemaining = Math.max(0, loan.remainingMinorUnits - payment.amount);
    const newStatus =
      newRemaining === 0
        ? 'settled'
        : newRemaining < loan.principalMinorUnits
          ? 'partially_paid'
          : 'active';

    const updatedLoan: Partial<Loan> = {
      payments: [...loan.payments, payment],
      remainingMinorUnits: newRemaining,
      status: newStatus,
      updatedAt: now(),
    };

    await db.loans.update(loanId, updatedLoan);
    set((s) => ({
      loans: s.loans.map((l) =>
        l.id === loanId ? { ...l, ...updatedLoan } : l,
      ),
    }));
  },
}));
