import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths, getDaysInMonth, getDate } from 'date-fns';
import { formatCurrency } from '../core/types';
import { generateInsights, type Insight } from '../core/insights';
import { useAccountStore } from '../store/useAccountStore';
import { useTransactionStore } from '../store/useTransactionStore';
import { useSubscriptionStore } from '../store/useSubscriptionStore';
import { useLoanStore } from '../store/useLoanStore';
import { useBudgetStore } from '../store/useBudgetStore';
import { useGoalStore } from '../store/useGoalStore';
import Card, { CardHeader, CardTitle } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import NetBalanceChart from '../components/dashboard/NetBalanceChart';
import CategoryDonut from '../components/dashboard/CategoryDonut';
import UpcomingBills from '../components/dashboard/UpcomingBills';

interface MonthStats {
  income: number;
  expenses: number;
  net: number;
  savingsRate: number;
}

function TrendBadge({ current, prev, inverse = false }: { current: number; prev: number; inverse?: boolean }) {
  if (prev === 0 || (current === 0 && prev === 0)) return null;
  const pct = prev !== 0 ? ((current - prev) / prev) * 100 : 0;
  if (Math.abs(pct) < 1) return <span className="text-xs text-slate-500">—</span>;
  const isUp = pct > 0;
  const isGood = inverse ? !isUp : isUp;
  return (
    <span className={`inline-flex items-center text-xs font-medium ${isGood ? 'text-emerald-400' : 'text-red-400'}`}>
      {isUp ? '↑' : '↓'}{Math.abs(pct).toFixed(0)}%
    </span>
  );
}

function InsightBanner({ insight }: { insight: Insight }) {
  const variantMap: Record<string, 'warning' | 'success' | 'info' | 'danger'> = {
    warning: 'warning',
    suggestion: 'info',
    info: 'info',
    success: 'success',
  };
  return (
    <div className="flex items-start gap-3 bg-slate-800 border border-slate-700 rounded-xl p-3">
      <Badge variant={variantMap[insight.type] ?? 'info'} className="mt-0.5 shrink-0">
        {insight.type === 'warning' ? '!' : insight.type === 'success' ? '✓' : 'i'}
      </Badge>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200">{insight.title}</p>
        <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{insight.description}</p>
      </div>
      {insight.actionRoute && (
        <Link to={insight.actionRoute} className="shrink-0 text-xs text-sky-400 hover:text-sky-300 transition-colors">
          View →
        </Link>
      )}
    </div>
  );
}

/** Clickable KPI card — navigates on click */
function KpiCard({
  label,
  to,
  children,
}: {
  label: string;
  to: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(to)}
      className="text-left w-full bg-slate-800 hover:bg-slate-700/70 active:bg-slate-700 border border-slate-700 rounded-xl p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 cursor-pointer"
      aria-label={`View ${label}`}
    >
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      {children}
    </button>
  );
}

export default function DashboardPage() {
  const { accounts, load: loadAccounts } = useAccountStore();
  const { transactions, load: loadTransactions } = useTransactionStore();
  const { subscriptions, load: loadSubscriptions } = useSubscriptionStore();
  const { loans, load: loadLoans } = useLoanStore();
  const { budgets, load: loadBudgets } = useBudgetStore();
  const { goals, load: loadGoals } = useGoalStore();

  const [stats, setStats] = useState<MonthStats>({ income: 0, expenses: 0, net: 0, savingsRate: 0 });
  const [lastStats, setLastStats] = useState<MonthStats>({ income: 0, expenses: 0, net: 0, savingsRate: 0 });
  const [insights, setInsights] = useState<Insight[]>([]);
  const [spentByCategory, setSpentByCategory] = useState<Record<string, number>>({});

  useEffect(() => {
    loadAccounts();
    loadTransactions();
    loadSubscriptions();
    loadLoans();
    loadBudgets();
    loadGoals();
  }, []);

  useEffect(() => {
    const now = new Date();

    // This month
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    const monthTxns = transactions.filter(
      (t) => !t.deletedAt && isWithinInterval(new Date(t.date), { start, end }),
    );
    const income = monthTxns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amountMinorUnits, 0);
    const expenses = monthTxns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amountMinorUnits, 0);
    setStats({
      income,
      expenses,
      net: income - expenses,
      savingsRate: income > 0 ? ((income - expenses) / income) * 100 : 0,
    });

    // Spent by category this month
    const catMap: Record<string, number> = {};
    for (const t of monthTxns.filter((t) => t.type === 'expense')) {
      catMap[t.category] = (catMap[t.category] ?? 0) + t.amountMinorUnits;
    }
    setSpentByCategory(catMap);

    // Last month
    const lastMonth = subMonths(now, 1);
    const lastStart = startOfMonth(lastMonth);
    const lastEnd = endOfMonth(lastMonth);
    const lastTxns = transactions.filter(
      (t) => !t.deletedAt && isWithinInterval(new Date(t.date), { start: lastStart, end: lastEnd }),
    );
    const lastIncome = lastTxns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amountMinorUnits, 0);
    const lastExpenses = lastTxns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amountMinorUnits, 0);
    setLastStats({
      income: lastIncome,
      expenses: lastExpenses,
      net: lastIncome - lastExpenses,
      savingsRate: lastIncome > 0 ? ((lastIncome - lastExpenses) / lastIncome) * 100 : 0,
    });
  }, [transactions]);

  useEffect(() => {
    generateInsights().then(setInsights).catch(console.error);
  }, [transactions, subscriptions, loans]);

  // Budget health
  const activeBudgets = budgets.filter((b) => b.isActive && !b.deletedAt);
  const budgetsOnTrack = activeBudgets.filter(
    (b) => (spentByCategory[b.category] ?? 0) <= b.amountMinorUnits,
  ).length;

  // Month elapsed
  const now = new Date();
  const daysInMonth = getDaysInMonth(now);
  const dayOfMonth = getDate(now);
  const monthPct = Math.round((dayOfMonth / daysInMonth) * 100);

  // Health signal
  const isHealthy = stats.net > 0 && stats.savingsRate >= 15;
  const isOk = stats.net > 0;
  const healthColor = isHealthy ? 'emerald' : isOk ? 'amber' : 'red';
  const healthMsg =
    stats.income === 0
      ? 'No income recorded yet — add your first transaction'
      : isHealthy
      ? `Saving ${stats.savingsRate.toFixed(0)}% of income · On track`
      : isOk
      ? `Saving ${stats.savingsRate.toFixed(0)}% · Aim for 15%+`
      : 'Spending more than you earn this month';

  const currency = accounts[0]?.currency ?? 'GBP';

  const activeLoans = loans.filter((l) => l.status !== 'settled' && !l.deletedAt);
  const totalOwed = activeLoans
    .filter((l) => l.direction === 'lent')
    .reduce((s, l) => s + l.remainingMinorUnits, 0);
  const totalBorrowed = activeLoans
    .filter((l) => l.direction === 'borrowed')
    .reduce((s, l) => s + l.remainingMinorUnits, 0);

  const monthlySubCost = subscriptions
    .filter((s) => s.isActive && !s.deletedAt)
    .reduce((s, sub) => {
      const monthly =
        sub.billingCycle === 'weekly' ? sub.amountMinorUnits * 4.33
        : sub.billingCycle === 'quarterly' ? sub.amountMinorUnits / 3
        : sub.billingCycle === 'annual' ? sub.amountMinorUnits / 12
        : sub.amountMinorUnits;
      return s + monthly;
    }, 0);

  // Goals summary
  const activeGoals = goals.filter((g) => !g.isAchieved && !g.deletedAt);
  const totalGoalTarget = activeGoals.reduce((s, g) => s + g.targetMinorUnits, 0);
  const totalGoalCurrent = activeGoals.reduce((s, g) => s + g.currentMinorUnits, 0);
  const goalsProgress = totalGoalTarget > 0 ? (totalGoalCurrent / totalGoalTarget) * 100 : 0;

  // Finance report guidance — derived from overall data
  const subPctOfIncome = stats.income > 0 ? (monthlySubCost / stats.income) * 100 : 0;
  const financeGuidance: string[] = [];
  if (stats.income > 0 && stats.savingsRate < 10) {
    financeGuidance.push(`Your savings rate is ${stats.savingsRate.toFixed(0)}% — reducing subscriptions or discretionary spend could help reach 20%.`);
  }
  if (subPctOfIncome > 20) {
    financeGuidance.push(`Subscriptions are ${subPctOfIncome.toFixed(0)}% of income. Review your active plans.`);
  }
  if (activeBudgets.length > 0 && budgetsOnTrack < activeBudgets.length) {
    financeGuidance.push(`${activeBudgets.length - budgetsOnTrack} of ${activeBudgets.length} budgets are over pace — check Budgets for details.`);
  }
  if (activeLoans.length > 0) {
    const overdue = activeLoans.filter((l) => l.dueDate && new Date(l.dueDate) < now);
    if (overdue.length > 0) financeGuidance.push(`${overdue.length} overdue loan${overdue.length > 1 ? 's' : ''} — consider recording payments.`);
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-6xl mx-auto">

      {/* Health banner — Zone A */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
        healthColor === 'emerald'
          ? 'bg-emerald-500/10 border-emerald-500/25'
          : healthColor === 'amber'
          ? 'bg-amber-500/10 border-amber-500/25'
          : 'bg-red-500/10 border-red-500/25'
      }`}>
        <div className={`w-2 h-2 rounded-full shrink-0 animate-pulse ${
          healthColor === 'emerald' ? 'bg-emerald-400' : healthColor === 'amber' ? 'bg-amber-400' : 'bg-red-400'
        }`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-200">{format(now, 'MMMM yyyy')}</p>
          <p className={`text-xs mt-0.5 ${
            healthColor === 'emerald' ? 'text-emerald-400' : healthColor === 'amber' ? 'text-amber-400' : 'text-red-400'
          }`}>{healthMsg}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-slate-400">Day {dayOfMonth} of {daysInMonth}</p>
          <p className="text-xs text-slate-600">{monthPct}% through</p>
        </div>
      </div>

      {/* Finance report guidance */}
      {financeGuidance.length > 0 && (
        <div className="space-y-2">
          {financeGuidance.map((tip, i) => (
            <div key={i} className="flex items-start gap-2 px-3 py-2 bg-amber-500/8 border border-amber-500/20 rounded-lg">
              <span className="text-amber-400 text-xs mt-0.5 shrink-0">▲</span>
              <p className="text-xs text-amber-300">{tip}</p>
            </div>
          ))}
        </div>
      )}

      {/* Hero metric — Net this month */}
      <div className="px-1">
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Net this month</p>
        <div className="flex items-baseline gap-3 flex-wrap">
          <p className={`text-4xl font-bold tracking-tight ${stats.net >= 0 ? 'text-sky-400' : 'text-red-400'}`}>
            {stats.net >= 0 ? '+' : ''}{formatCurrency(stats.net, currency)}
          </p>
          <TrendBadge current={stats.net} prev={lastStats.net} />
          {lastStats.net !== 0 && (
            <span className="text-xs text-slate-500">vs {format(subMonths(now, 1), 'MMM')}</span>
          )}
        </div>
      </div>

      {/* KPI row — Zone B — all cards are clickable */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Income" to="/transactions">
          <p className="text-xl font-bold text-emerald-400 mt-1">{formatCurrency(stats.income, currency)}</p>
          <div className="mt-1"><TrendBadge current={stats.income} prev={lastStats.income} /></div>
        </KpiCard>
        <KpiCard label="Expenses" to="/transactions">
          <p className="text-xl font-bold text-red-400 mt-1">{formatCurrency(stats.expenses, currency)}</p>
          <div className="mt-1"><TrendBadge current={stats.expenses} prev={lastStats.expenses} inverse /></div>
        </KpiCard>
        <KpiCard label="Savings rate" to="/insights">
          <p className={`text-xl font-bold mt-1 ${stats.savingsRate >= 20 ? 'text-emerald-400' : stats.savingsRate >= 10 ? 'text-amber-400' : 'text-red-400'}`}>
            {stats.savingsRate.toFixed(0)}%
          </p>
          <div className="mt-1"><TrendBadge current={stats.savingsRate} prev={lastStats.savingsRate} /></div>
        </KpiCard>
        <KpiCard label="Budget health" to="/budgets">
          {activeBudgets.length > 0 ? (
            <>
              <p className={`text-xl font-bold mt-1 ${
                budgetsOnTrack === activeBudgets.length ? 'text-emerald-400'
                : budgetsOnTrack >= activeBudgets.length / 2 ? 'text-amber-400'
                : 'text-red-400'
              }`}>
                {budgetsOnTrack}/{activeBudgets.length}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">on track</p>
            </>
          ) : (
            <>
              <p className="text-xl font-bold text-slate-500 mt-1">—</p>
              <p className="text-xs text-sky-400 mt-0.5">Set up budgets</p>
            </>
          )}
        </KpiCard>
      </div>

      {/* Charts — Zone C */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Income vs Expenses</CardTitle>
            <span className="text-xs text-slate-500">Last 6 months</span>
          </CardHeader>
          <NetBalanceChart />
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Spending by category</CardTitle>
            <span className="text-xs text-slate-500">This month</span>
          </CardHeader>
          <CategoryDonut />
        </Card>
      </div>

      {/* Goals summary */}
      {activeGoals.length > 0 && (
        <button
          onClick={() => { window.location.href = '/goals'; }}
          className="w-full text-left bg-slate-800 hover:bg-slate-700/70 border border-slate-700 rounded-xl p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          aria-label="View financial goals"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-200">Financial Goals</p>
            <span className="text-xs text-sky-400">View all →</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2 mb-1">
            <div
              className="h-2 rounded-full bg-sky-500 transition-all"
              style={{ width: `${Math.min(goalsProgress, 100)}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">
            {activeGoals.length} active goal{activeGoals.length !== 1 ? 's' : ''} · {goalsProgress.toFixed(0)}% overall progress
          </p>
        </button>
      )}

      {/* Insights + upcoming bills — Zone D */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {insights.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Insights</CardTitle>
              <Link to="/insights" className="text-xs text-sky-400 hover:text-sky-300">See all</Link>
            </CardHeader>
            <div className="space-y-2">
              {insights.slice(0, 3).map((insight) => (
                <InsightBanner key={insight.id} insight={insight} />
              ))}
            </div>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming bills</CardTitle>
            <Link to="/subscriptions" className="text-xs text-sky-400 hover:text-sky-300">Manage</Link>
          </CardHeader>
          <UpcomingBills />
        </Card>
      </div>

      {/* Secondary stats (conditional — only when data exists) */}
      {(monthlySubCost > 0 || totalOwed > 0 || totalBorrowed > 0) && (
        <div className="grid grid-cols-3 gap-3">
          {monthlySubCost > 0 && (
            <button
              onClick={() => { window.location.href = '/subscriptions'; }}
              className="text-left bg-slate-800 hover:bg-slate-700/70 border border-slate-700 rounded-xl p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              aria-label="View subscriptions"
            >
              <p className="text-xs text-slate-500 uppercase tracking-wide">Monthly subs</p>
              <p className="text-base font-semibold text-amber-400 mt-1">{formatCurrency(monthlySubCost, currency)}</p>
              <p className="text-xs text-slate-500 mt-0.5">{subscriptions.filter((s) => s.isActive).length} active</p>
            </button>
          )}
          {totalOwed > 0 && (
            <button
              onClick={() => { window.location.href = '/loans'; }}
              className="text-left bg-slate-800 hover:bg-slate-700/70 border border-slate-700 rounded-xl p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              aria-label="View loans owed to you"
            >
              <p className="text-xs text-slate-500 uppercase tracking-wide">Owed to you</p>
              <p className="text-base font-semibold text-emerald-400 mt-1">{formatCurrency(totalOwed, currency)}</p>
            </button>
          )}
          {totalBorrowed > 0 && (
            <button
              onClick={() => { window.location.href = '/loans'; }}
              className="text-left bg-slate-800 hover:bg-slate-700/70 border border-slate-700 rounded-xl p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              aria-label="View loans you owe"
            >
              <p className="text-xs text-slate-500 uppercase tracking-wide">You owe</p>
              <p className="text-base font-semibold text-red-400 mt-1">{formatCurrency(totalBorrowed, currency)}</p>
            </button>
          )}
        </div>
      )}

      {/* Recent transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
          <Link to="/transactions" className="text-xs text-sky-400 hover:text-sky-300">View all</Link>
        </CardHeader>
        {transactions.length === 0 ? (
          <div className="py-8 text-center space-y-3">
            <p className="text-slate-500 text-sm">No transactions yet.</p>
            <Link
              to="/transactions"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <span aria-hidden="true">+</span> Add your first transaction
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-slate-700/50" role="list">
            {transactions.slice(0, 5).map((txn) => (
              <li key={txn.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium text-slate-200">{txn.merchant ?? txn.category}</p>
                  <p className="text-xs text-slate-500">{txn.category} · {txn.date}</p>
                </div>
                <span className={`text-sm font-semibold ${txn.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {txn.type === 'income' ? '+' : '-'}{formatCurrency(txn.amountMinorUnits, txn.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
