import { db } from './db';
import type { Account, Transaction, Loan, Subscription, Budget, FinancialGoal } from './types';

const EXPORT_VERSION = 1;

export interface ExportPayload {
  version: number;
  exportedAt: string;
  accounts: Account[];
  transactions: Transaction[];
  loans: Loan[];
  subscriptions: Subscription[];
  budgets: Budget[];
  goals: FinancialGoal[];
}

export async function exportAllData(): Promise<string> {
  const [accounts, transactions, loans, subscriptions, budgets, goals] = await Promise.all([
    db.accounts.toArray(),
    db.transactions.toArray(),
    db.loans.toArray(),
    db.subscriptions.toArray(),
    db.budgets.toArray(),
    db.goals.toArray(),
  ]);

  const payload: ExportPayload = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    accounts,
    transactions,
    loans,
    subscriptions,
    budgets,
    goals,
  };
  return JSON.stringify(payload, null, 2);
}

export function downloadJSON(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCSV(rows: Record<string, unknown>[], filename: string): void {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = String(row[h] ?? '');
          return val.includes(',') || val.includes('"') || val.includes('\n')
            ? `"${val.replace(/"/g, '""')}"`
            : val;
        })
        .join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importData(jsonString: string): Promise<void> {
  const data = JSON.parse(jsonString) as ExportPayload;
  if (data.version !== EXPORT_VERSION) throw new Error('Unsupported export version');

  await db.transaction(
    'rw',
    [db.accounts, db.transactions, db.loans, db.subscriptions, db.budgets, db.goals],
    async () => {
      await db.accounts.bulkPut(data.accounts ?? []);
      await db.transactions.bulkPut(data.transactions ?? []);
      await db.loans.bulkPut(data.loans ?? []);
      await db.subscriptions.bulkPut(data.subscriptions ?? []);
      await db.budgets.bulkPut(data.budgets ?? []);
      await db.goals.bulkPut(data.goals ?? []);
    },
  );
}

export async function deleteAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.accounts, db.transactions, db.loans, db.subscriptions, db.budgets, db.goals, db.recurringRules],
    async () => {
      await db.accounts.clear();
      await db.transactions.clear();
      await db.loans.clear();
      await db.subscriptions.clear();
      await db.budgets.clear();
      await db.goals.clear();
      await db.recurringRules.clear();
    },
  );
  localStorage.clear();
}
