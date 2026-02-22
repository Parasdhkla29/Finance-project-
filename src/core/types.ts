export type Currency = string; // ISO 4217

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

// ── Account ────────────────────────────────────────────────────────────────

export type AccountType = 'checking' | 'savings' | 'cash' | 'credit' | 'investment';

export interface Account extends BaseEntity {
  name: string;
  type: AccountType;
  currency: Currency;
  color: string;
  isArchived: boolean;
  notes?: string;
}

// ── Transaction ────────────────────────────────────────────────────────────

export type TransactionType = 'income' | 'expense' | 'transfer';
export type PaymentMethod = 'card' | 'cash' | 'bank_transfer' | 'direct_debit' | 'other';

export interface Transaction extends BaseEntity {
  accountId: string;
  type: TransactionType;
  amountMinorUnits: number; // pence/cents — avoids float errors
  currency: Currency;
  category: string;
  subcategory?: string;
  merchant?: string;
  notes?: string;
  date: string; // ISO 8601
  paymentMethod?: PaymentMethod;
  tags: string[];
  isRecurring: boolean;
  recurringId?: string;
}

// ── Loan ───────────────────────────────────────────────────────────────────

export type LoanDirection = 'lent' | 'borrowed';
export type LoanStatus = 'active' | 'partially_paid' | 'settled' | 'overdue';

export interface LoanPayment {
  id: string;
  amount: number; // minor units
  date: string;
  notes?: string;
}

export interface Loan extends BaseEntity {
  direction: LoanDirection;
  counterparty: string; // person or entity name
  principalMinorUnits: number;
  currency: Currency;
  remainingMinorUnits: number;
  interestRate?: number; // annual %
  startDate: string;
  dueDate?: string;
  status: LoanStatus;
  notes?: string;
  payments: LoanPayment[];
}

// ── Subscription ───────────────────────────────────────────────────────────

export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'annual';

export interface Subscription extends BaseEntity {
  name: string;
  amountMinorUnits: number;
  currency: Currency;
  billingCycle: BillingCycle;
  nextBillingDate: string;
  category: string;
  accountId?: string;
  url?: string;
  isActive: boolean;
  notes?: string;
}

// ── Budget ─────────────────────────────────────────────────────────────────

export type BudgetPeriod = 'weekly' | 'monthly';

export interface Budget extends BaseEntity {
  name: string;
  category: string;
  amountMinorUnits: number;
  period: BudgetPeriod;
  isActive: boolean;
}

// ── Financial Goal ─────────────────────────────────────────────────────────

export type GoalCategory =
  | 'emergency_fund'
  | 'investment'
  | 'purchase'
  | 'debt_payoff'
  | 'custom';

export interface FinancialGoal extends BaseEntity {
  name: string;
  targetMinorUnits: number;
  currentMinorUnits: number;
  currency: Currency;
  targetDate?: string;
  category: GoalCategory;
  notes?: string;
  isAchieved: boolean;
}

// ── Recurring Rule ─────────────────────────────────────────────────────────

export type RecurringFrequency =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'annual';

export interface RecurringRule extends BaseEntity {
  templateAccountId: string;
  templateType: TransactionType;
  templateAmountMinorUnits: number;
  templateCurrency: Currency;
  templateCategory: string;
  templateMerchant?: string;
  templateNotes?: string;
  frequency: RecurringFrequency;
  startDate: string;
  endDate?: string;
  lastGeneratedDate?: string;
  isActive: boolean;
}

// ── User Settings ──────────────────────────────────────────────────────────

export interface UserSettings {
  displayName: string;
  currency: Currency;
  theme: 'dark' | 'light' | 'system';
  cloudEnabled: boolean;
}

// ── Utilities ──────────────────────────────────────────────────────────────

/** Convert minor units (pence/cents) to major units for display */
export function toMajor(minor: number): number {
  return minor / 100;
}

/** Convert major units to minor units for storage */
export function toMinor(major: number): number {
  return Math.round(major * 100);
}

/** Format currency for display */
export function formatCurrency(minorUnits: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(minorUnits / 100);
}

/** Generate a UUID */
export function newId(): string {
  return crypto.randomUUID();
}

/** ISO 8601 timestamp */
export function now(): string {
  return new Date().toISOString();
}
