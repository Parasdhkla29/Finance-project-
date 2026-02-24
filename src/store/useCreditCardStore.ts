import { create } from 'zustand';
import { db } from '../core/db';
import type { CreditCard, CreditCardTransaction } from '../core/types';
import { newId, now } from '../core/types';

interface CreditCardState {
  cards: CreditCard[];
  loading: boolean;
  load: () => Promise<void>;
  add: (data: Omit<CreditCard, 'id' | 'createdAt' | 'updatedAt' | 'transactions'>) => Promise<CreditCard>;
  update: (id: string, data: Partial<CreditCard>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  addTransaction: (cardId: string, txn: Omit<CreditCardTransaction, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  removeTransaction: (cardId: string, txnId: string) => Promise<void>;
  recordPayment: (cardId: string, amountMinorUnits: number) => Promise<void>;
}

export const useCreditCardStore = create<CreditCardState>((set, get) => ({
  cards: [],
  loading: false,

  load: async () => {
    set({ loading: true });
    const cards = await db.creditCards.filter((c) => !c.deletedAt).toArray();
    cards.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    set({ cards, loading: false });
  },

  add: async (data) => {
    const card: CreditCard = {
      id: newId(),
      createdAt: now(),
      updatedAt: now(),
      transactions: [],
      ...data,
    };
    await db.creditCards.add(card);
    set((s) => ({ cards: [card, ...s.cards] }));
    return card;
  },

  update: async (id, data) => {
    const updated = { ...data, updatedAt: now() };
    await db.creditCards.update(id, updated);
    set((s) => ({
      cards: s.cards.map((c) => (c.id === id ? { ...c, ...updated } : c)),
    }));
  },

  remove: async (id) => {
    await db.creditCards.update(id, { deletedAt: now(), updatedAt: now() });
    set((s) => ({ cards: s.cards.filter((c) => c.id !== id) }));
  },

  addTransaction: async (cardId, txnData) => {
    const { cards } = get();
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    const txn: CreditCardTransaction = {
      id: newId(),
      createdAt: now(),
      updatedAt: now(),
      ...txnData,
    };
    const newBalance = card.balanceMinorUnits + txn.amountMinorUnits;
    const updatedCard: Partial<CreditCard> = {
      transactions: [...card.transactions, txn],
      balanceMinorUnits: newBalance,
      updatedAt: now(),
    };
    await db.creditCards.update(cardId, updatedCard);
    set((s) => ({
      cards: s.cards.map((c) => (c.id === cardId ? { ...c, ...updatedCard } : c)),
    }));
  },

  removeTransaction: async (cardId, txnId) => {
    const { cards } = get();
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    const txn = card.transactions.find((t) => t.id === txnId);
    if (!txn) return;

    const updatedCard: Partial<CreditCard> = {
      transactions: card.transactions.filter((t) => t.id !== txnId),
      balanceMinorUnits: Math.max(0, card.balanceMinorUnits - txn.amountMinorUnits),
      updatedAt: now(),
    };
    await db.creditCards.update(cardId, updatedCard);
    set((s) => ({
      cards: s.cards.map((c) => (c.id === cardId ? { ...c, ...updatedCard } : c)),
    }));
  },

  recordPayment: async (cardId, amountMinorUnits) => {
    const { cards } = get();
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    const newBalance = Math.max(0, card.balanceMinorUnits - amountMinorUnits);
    const newStatus: CreditCard['status'] = newBalance === 0 ? 'active' : card.status === 'overdue' ? 'active' : card.status;
    const updatedCard: Partial<CreditCard> = {
      balanceMinorUnits: newBalance,
      status: newStatus,
      updatedAt: now(),
    };
    await db.creditCards.update(cardId, updatedCard);
    set((s) => ({
      cards: s.cards.map((c) => (c.id === cardId ? { ...c, ...updatedCard } : c)),
    }));
  },
}));
