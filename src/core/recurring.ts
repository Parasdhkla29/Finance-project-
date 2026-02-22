import { db } from './db';
import { addDays, addWeeks, addMonths, addQuarters, addYears, isBefore } from 'date-fns';
import type { Transaction } from './types';
import { newId, now } from './types';

function nextOccurrence(from: Date, frequency: string): Date {
  switch (frequency) {
    case 'daily':     return addDays(from, 1);
    case 'weekly':    return addWeeks(from, 1);
    case 'biweekly':  return addWeeks(from, 2);
    case 'monthly':   return addMonths(from, 1);
    case 'quarterly': return addQuarters(from, 1);
    case 'annual':    return addYears(from, 1);
    default:          return addMonths(from, 1);
  }
}

/**
 * Called on app startup. Generates missing transaction instances for every
 * active RecurringRule since its lastGeneratedDate.
 * Returns the number of new transactions created.
 */
export async function processRecurringRules(): Promise<number> {
  const rules = await db.recurringRules
    .filter((r) => r.isActive && !r.deletedAt)
    .toArray();

  let created = 0;
  const today = new Date();

  for (const rule of rules) {
    const startFrom = rule.lastGeneratedDate
      ? new Date(rule.lastGeneratedDate)
      : new Date(rule.startDate);

    let current = nextOccurrence(startFrom, rule.frequency);

    if (rule.endDate && isBefore(new Date(rule.endDate), current)) continue;

    const newTxns: Transaction[] = [];
    while (isBefore(current, today)) {
      if (rule.endDate && isBefore(new Date(rule.endDate), current)) break;

      newTxns.push({
        id: newId(),
        accountId: rule.templateAccountId,
        type: rule.templateType,
        amountMinorUnits: rule.templateAmountMinorUnits,
        currency: rule.templateCurrency,
        category: rule.templateCategory,
        merchant: rule.templateMerchant,
        notes: rule.templateNotes,
        date: current.toISOString().split('T')[0],
        tags: [],
        isRecurring: true,
        recurringId: rule.id,
        createdAt: now(),
        updatedAt: now(),
      });

      current = nextOccurrence(current, rule.frequency);
    }

    if (newTxns.length > 0) {
      await db.transactions.bulkAdd(newTxns);
      await db.recurringRules.update(rule.id, {
        lastGeneratedDate: newTxns[newTxns.length - 1].date,
        updatedAt: now(),
      });
      created += newTxns.length;
    }
  }

  return created;
}
