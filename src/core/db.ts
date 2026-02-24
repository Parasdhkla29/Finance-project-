import Dexie, { type Table } from 'dexie';
import type {
  Account,
  Transaction,
  Loan,
  Subscription,
  Budget,
  FinancialGoal,
  RecurringRule,
  CreditCard,
} from './types';

export class PrivyLedgerDB extends Dexie {
  accounts!: Table<Account>;
  transactions!: Table<Transaction>;
  loans!: Table<Loan>;
  subscriptions!: Table<Subscription>;
  budgets!: Table<Budget>;
  goals!: Table<FinancialGoal>;
  recurringRules!: Table<RecurringRule>;
  creditCards!: Table<CreditCard>;

  constructor() {
    super('PrivyLedgerDB');
    this.version(1).stores({
      accounts:
        'id, type, isArchived, deletedAt',
      transactions:
        'id, accountId, type, category, date, isRecurring, recurringId, deletedAt',
      loans:
        'id, direction, status, dueDate, counterparty, deletedAt',
      subscriptions:
        'id, isActive, nextBillingDate, category, deletedAt',
      budgets:
        'id, category, isActive, deletedAt',
      goals:
        'id, category, isAchieved, deletedAt',
      recurringRules:
        'id, isActive, deletedAt',
    });
    this.version(2).stores({
      accounts:
        'id, type, isArchived, deletedAt',
      transactions:
        'id, accountId, type, category, date, isRecurring, recurringId, deletedAt',
      loans:
        'id, direction, status, dueDate, counterparty, deletedAt',
      subscriptions:
        'id, isActive, nextBillingDate, category, deletedAt',
      budgets:
        'id, category, isActive, deletedAt',
      goals:
        'id, category, isAchieved, deletedAt',
      recurringRules:
        'id, isActive, deletedAt',
      creditCards:
        'id, status, dueDate, network, deletedAt',
    });
  }
}

export const db = new PrivyLedgerDB();

/** Filter helper: only non-deleted records */
export function active<T extends { deletedAt?: string }>(records: T[]): T[] {
  return records.filter((r) => !r.deletedAt);
}
