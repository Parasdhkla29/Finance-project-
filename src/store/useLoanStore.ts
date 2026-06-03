import { create } from 'zustand';
import { db } from '../core/db';
import type { Loan, LoanPayment } from '../core/types';
import { newId, now } from '../core/types';
import { getCurrentUserId } from '../auth/useAuthStore';

interface LoanState {
  loans: Loan[];
  loading: boolean;
  load: () => Promise<void>;
  add: (data: Omit<Loan, 'id' | 'createdAt' | 'updatedAt' | 'payments'>) => Promise<Loan>;
  update: (id: string, data: Partial<Loan>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  addPayment: (loanId: string, payment: Omit<LoanPayment, 'id'>) => Promise<void>;
  updatePayment: (loanId: string, paymentId: string, data: Omit<LoanPayment, 'id'>) => Promise<void>;
  removePayment: (loanId: string, paymentId: string) => Promise<void>;
}

export const useLoanStore = create<LoanState>((set, get) => ({
  loans: [],
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      const userId = getCurrentUserId();
      const loans = await db.loans.forUser(userId).toArray();
      loans.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      set({ loans, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  add: async (data) => {
    const userId = getCurrentUserId();
    const loan: Loan = { id: newId(), createdAt: now(), updatedAt: now(), payments: [], ...data };
    await db.loans.forUser(userId).add(loan);
    set((s) => ({ loans: [loan, ...s.loans] }));
    return loan;
  },

  update: async (id, data) => {
    const updated = { ...data, updatedAt: now() };
    await db.loans.update(id, updated);
    set((s) => ({ loans: s.loans.map((l) => (l.id === id ? { ...l, ...updated } : l)) }));
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
    const newStatus = newRemaining === 0 ? 'settled' : newRemaining < loan.principalMinorUnits ? 'partially_paid' : 'active';
    const updatedLoan: Partial<Loan> = { payments: [...loan.payments, payment], remainingMinorUnits: newRemaining, status: newStatus, updatedAt: now() };
    await db.loans.update(loanId, updatedLoan);
    set((s) => ({ loans: s.loans.map((l) => (l.id === loanId ? { ...l, ...updatedLoan } : l)) }));
  },

  updatePayment: async (loanId, paymentId, data) => {
    const { loans } = get();
    const loan = loans.find((l) => l.id === loanId);
    if (!loan) return;
    const oldPayment = loan.payments.find((p) => p.id === paymentId);
    if (!oldPayment) return;
    const delta = data.amount - oldPayment.amount;
    const newRemaining = Math.max(0, Math.min(loan.principalMinorUnits, loan.remainingMinorUnits - delta));
    const newStatus: Loan['status'] = newRemaining === 0 ? 'settled' : newRemaining < loan.principalMinorUnits ? 'partially_paid' : 'active';
    const updatedLoan: Partial<Loan> = { payments: loan.payments.map((p) => (p.id === paymentId ? { ...p, ...data } : p)), remainingMinorUnits: newRemaining, status: newStatus, updatedAt: now() };
    await db.loans.update(loanId, updatedLoan);
    set((s) => ({ loans: s.loans.map((l) => (l.id === loanId ? { ...l, ...updatedLoan } : l)) }));
  },

  removePayment: async (loanId, paymentId) => {
    const { loans } = get();
    const loan = loans.find((l) => l.id === loanId);
    if (!loan) return;
    const payment = loan.payments.find((p) => p.id === paymentId);
    if (!payment) return;
    const newRemaining = Math.min(loan.principalMinorUnits, loan.remainingMinorUnits + payment.amount);
    const newStatus: Loan['status'] = newRemaining === 0 ? 'settled' : newRemaining < loan.principalMinorUnits ? 'partially_paid' : 'active';
    const updatedLoan: Partial<Loan> = { payments: loan.payments.filter((p) => p.id !== paymentId), remainingMinorUnits: newRemaining, status: newStatus, updatedAt: now() };
    await db.loans.update(loanId, updatedLoan);
    set((s) => ({ loans: s.loans.map((l) => (l.id === loanId ? { ...l, ...updatedLoan } : l)) }));
  },
}));
