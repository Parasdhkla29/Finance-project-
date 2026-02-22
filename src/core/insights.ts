import { db } from './db';
import { addDays, startOfMonth, endOfMonth, isWithinInterval, subMonths } from 'date-fns';
import { toMajor } from './types';

export interface Insight {
  id: string;
  type: 'warning' | 'suggestion' | 'info' | 'success';
  title: string;
  description: string;
  actionLabel?: string;
  actionRoute?: string;
}

export interface MonthSummary {
  income: number;
  expenses: number;
  net: number;
  savingsRate: number;
  topCategories: Array<{ category: string; amount: number }>;
}

export async function generateInsights(): Promise<Insight[]> {
  const insights: Insight[] = [];
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // 1. Upcoming bills (subscriptions due in 7 days)
  const subs = await db.subscriptions
    .filter((s) => s.isActive && !s.deletedAt)
    .toArray();
  const upcoming = subs.filter((s) => {
    const due = new Date(s.nextBillingDate);
    return isWithinInterval(due, { start: now, end: addDays(now, 7) });
  });
  if (upcoming.length > 0) {
    insights.push({
      id: 'upcoming-bills',
      type: 'warning',
      title: `${upcoming.length} bill${upcoming.length > 1 ? 's' : ''} due this week`,
      description: upcoming.map((s) => s.name).join(', '),
      actionLabel: 'View subscriptions',
      actionRoute: '/subscriptions',
    });
  }

  // 2. Overdue loans
  const loans = await db.loans
    .filter((l) => !l.deletedAt && l.status !== 'settled')
    .toArray();
  const overdue = loans.filter((l) => l.dueDate && new Date(l.dueDate) < now);
  if (overdue.length > 0) {
    insights.push({
      id: 'overdue-loans',
      type: 'warning',
      title: `${overdue.length} overdue loan${overdue.length > 1 ? 's' : ''}`,
      description: overdue
        .map((l) => `${l.direction === 'lent' ? 'Owed by' : 'You owe'} ${l.counterparty}`)
        .join(', '),
      actionLabel: 'View loans',
      actionRoute: '/loans',
    });
  }

  // 3. Monthly savings rate
  const txns = await db.transactions
    .filter(
      (t) =>
        !t.deletedAt &&
        isWithinInterval(new Date(t.date), { start: monthStart, end: monthEnd }),
    )
    .toArray();
  const income = txns
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amountMinorUnits, 0);
  const expense = txns
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amountMinorUnits, 0);

  if (income > 0) {
    const savingsRate = ((income - expense) / income) * 100;
    if (savingsRate < 10) {
      insights.push({
        id: 'low-savings',
        type: 'suggestion',
        title: `Low savings rate: ${savingsRate.toFixed(0)}%`,
        description: 'Aim for at least 20% to build financial resilience.',
        actionLabel: 'View insights',
        actionRoute: '/insights',
      });
    } else if (savingsRate >= 20) {
      insights.push({
        id: 'good-savings',
        type: 'success',
        title: `Great savings rate: ${savingsRate.toFixed(0)}%`,
        description: "You're on track. Consider investing the surplus.",
        actionLabel: 'View insights',
        actionRoute: '/insights',
      });
    }
  }

  // 4. Idle subscriptions (active 60+ days, no linked transactions)
  const sixtyDaysAgo = addDays(now, -60);
  for (const sub of subs) {
    if (new Date(sub.createdAt) > sixtyDaysAgo) continue;
    const linked = await db.transactions
      .filter(
        (t) =>
          !t.deletedAt &&
          (t.merchant?.toLowerCase().includes(sub.name.toLowerCase()) ?? false) &&
          new Date(t.date) > sixtyDaysAgo,
      )
      .count();
    if (linked === 0) {
      insights.push({
        id: `idle-sub-${sub.id}`,
        type: 'suggestion',
        title: `Possibly unused: ${sub.name}`,
        description: 'No transactions linked in 60 days. Worth cancelling?',
        actionLabel: 'Review subscriptions',
        actionRoute: '/subscriptions',
      });
      break; // only one idle sub insight per run
    }
  }

  // 5. Anomaly: spending > 2× 3-month average in a category this month
  const threeMonthsAgo = subMonths(monthStart, 3);
  const recentTxns = await db.transactions
    .filter(
      (t) =>
        !t.deletedAt &&
        t.type === 'expense' &&
        new Date(t.date) >= threeMonthsAgo &&
        new Date(t.date) < monthStart,
    )
    .toArray();

  const categoryAvg: Record<string, number> = {};
  const categoryCount: Record<string, number> = {};
  for (const t of recentTxns) {
    categoryAvg[t.category] = (categoryAvg[t.category] ?? 0) + t.amountMinorUnits;
    categoryCount[t.category] = (categoryCount[t.category] ?? 0) + 1;
  }
  for (const cat of Object.keys(categoryAvg)) {
    categoryAvg[cat] = categoryAvg[cat] / 3; // average per month
  }

  const thisMonthByCategory: Record<string, number> = {};
  for (const t of txns.filter((t) => t.type === 'expense')) {
    thisMonthByCategory[t.category] =
      (thisMonthByCategory[t.category] ?? 0) + t.amountMinorUnits;
  }

  for (const [cat, spent] of Object.entries(thisMonthByCategory)) {
    const avg = categoryAvg[cat] ?? 0;
    if (avg > 0 && spent > avg * 2) {
      insights.push({
        id: `anomaly-${cat}`,
        type: 'warning',
        title: `High ${cat} spending`,
        description: `You've spent ${toMajor(spent).toFixed(0)} vs avg ${toMajor(avg).toFixed(0)} — more than 2× usual.`,
        actionLabel: 'View transactions',
        actionRoute: '/transactions',
      });
    }
  }

  // 6. Budget overruns
  const budgets = await db.budgets
    .filter((b) => b.isActive && !b.deletedAt)
    .toArray();
  for (const budget of budgets) {
    const spent = txns
      .filter((t) => t.type === 'expense' && t.category === budget.category)
      .reduce((s, t) => s + t.amountMinorUnits, 0);
    const pct = budget.amountMinorUnits > 0 ? (spent / budget.amountMinorUnits) * 100 : 0;
    if (pct >= 100) {
      insights.push({
        id: `budget-over-${budget.id}`,
        type: 'warning',
        title: `Budget exceeded: ${budget.category}`,
        description: `Spent ${pct.toFixed(0)}% of your ${budget.name} budget.`,
        actionLabel: 'View budgets',
        actionRoute: '/budgets',
      });
    } else if (pct >= 80) {
      insights.push({
        id: `budget-warn-${budget.id}`,
        type: 'warning',
        title: `Budget almost full: ${budget.category}`,
        description: `At ${pct.toFixed(0)}% of your ${budget.name} budget.`,
        actionLabel: 'View budgets',
        actionRoute: '/budgets',
      });
    }
  }

  return insights;
}

export async function getMonthSummary(year: number, month: number): Promise<MonthSummary> {
  const start = new Date(year, month - 1, 1);
  const end = endOfMonth(start);

  const txns = await db.transactions
    .filter(
      (t) =>
        !t.deletedAt &&
        isWithinInterval(new Date(t.date), { start, end }),
    )
    .toArray();

  const income = txns
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amountMinorUnits, 0);
  const expenses = txns
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amountMinorUnits, 0);

  const categoryMap: Record<string, number> = {};
  for (const t of txns.filter((t) => t.type === 'expense')) {
    categoryMap[t.category] = (categoryMap[t.category] ?? 0) + t.amountMinorUnits;
  }
  const topCategories = Object.entries(categoryMap)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return {
    income,
    expenses,
    net: income - expenses,
    savingsRate: income > 0 ? ((income - expenses) / income) * 100 : 0,
    topCategories,
  };
}

/** Cash flow projection: net over next 30 days based on subscriptions + avg income */
export async function getCashFlowProjection(): Promise<number> {
  const now = new Date();
  const next30 = addDays(now, 30);

  // Upcoming subscription costs
  const subs = await db.subscriptions
    .filter((s) => s.isActive && !s.deletedAt)
    .toArray();
  const upcomingSubs = subs
    .filter((s) => {
      const due = new Date(s.nextBillingDate);
      return isWithinInterval(due, { start: now, end: next30 });
    })
    .reduce((s, sub) => s + sub.amountMinorUnits, 0);

  // Average monthly income (last 3 months)
  const threeMonthsAgo = subMonths(now, 3);
  const incomeTxns = await db.transactions
    .filter(
      (t) =>
        !t.deletedAt &&
        t.type === 'income' &&
        new Date(t.date) >= threeMonthsAgo,
    )
    .toArray();
  const avgMonthlyIncome =
    incomeTxns.reduce((s, t) => s + t.amountMinorUnits, 0) / 3;

  return avgMonthlyIncome - upcomingSubs;
}
