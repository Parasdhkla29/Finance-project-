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
import { useUIStore } from '../store/useUIStore';
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

interface AccountMonthStat {
  id: string;
  name: string;
  color: string;
  currency: string;
  income: number;
  expenses: number;
  net: number;
}

const QUICK_CURRENCIES = ['GBP', 'INR'] as const;

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
  const navigate = useNavigate();
  const { accounts, load: loadAccounts } = useAccountStore();
  const { transactions, load: loadTransactions } = useTransactionStore();
  const { subscriptions, load: loadSubscriptions } = useSubscriptionStore();
  const { loans, load: loadLoans } = useLoanStore();
  const { budgets, load: loadBudgets } = useBudgetStore();
  const { goals, load: loadGoals } = useGoalStore();
  const { currency, setCurrency } = useUIStore();

  const [stats, setStats] = useState<MonthStats>({ income: 0, expenses: 0, net: 0, savingsRate: 0 });
  const [lastStats, setLastStats] = useState<MonthStats>({ income: 0, expenses: 0, net: 0, savingsRate: 0 });
  const [accountStats, setAccountStats] = useState<AccountMonthStat[]>([]);
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
    // "Today" as an ISO date string for comparing transaction dates
    const todayStr = now.toISOString().split('T')[0];

    // This month
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    const monthTxns = transactions.filter(
      (t) => !t.deletedAt && isWithinInterval(new Date(t.date), { start, end }),
    );

    // Only count income that has actually arrived (date ≤ today).
    // Future-scheduled income is logged but excluded until its date comes.
    const income = monthTxns
      .filter((t) => t.type === 'income' && t.date <= todayStr)
      .reduce((s, t) => s + t.amountMinorUnits, 0);
    const expenses = monthTxns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amountMinorUnits, 0);
    setStats({
      income,
      expenses,
      net: income - expenses,
      savingsRate: income > 0 ? ((income - expenses) / income) * 100 : 0,
    });

    // Per-account net for this month (same future-income exclusion)
    const activeAccs = accounts.filter((a) => !a.isArchived && !a.deletedAt);
    setAccountStats(
      activeAccs.map((acc) => {
        const accTxns = monthTxns.filter((t) => t.accountId === acc.id);
        const accIncome = accTxns.filter((t) => t.type === 'income' && t.date <= todayStr).reduce((s, t) => s + t.amountMinorUnits, 0);
        const accExpenses = accTxns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amountMinorUnits, 0);
        return {
          id: acc.id,
          name: acc.name,
          color: acc.color,
          currency: acc.currency,
          income: accIncome,
          expenses: accExpenses,
          net: accIncome - accExpenses,
        };
      }),
    );

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
  }, [transactions, accounts]);

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

  // Sum of account nets for the currently selected display currency
  const accountsInCurrency = accountStats.filter((a) => a.currency === currency);
  const totalForCurrency = accountsInCurrency.length > 0
    ? accountsInCurrency.reduce((s, a) => s + a.net, 0)
    : stats.net;

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
    <div className="p-4 lg:p-6 space-y-4 max-w-6xl mx-auto">

      {/* Finance guidance tips */}
      {financeGuidance.length > 0 && (
        <div className="space-y-1.5">
          {financeGuidance.map((tip, i) => (
            <div key={i} className="flex items-start gap-2 px-3 py-2 bg-amber-500/6 border border-amber-500/15 rounded-xl">
              <span className="text-amber-400 text-xs mt-0.5 shrink-0">▲</span>
              <p className="text-xs text-amber-300/90">{tip}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Zone B: Hero + KPIs (with month header integrated) ── */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 space-y-4">

        {/* ── Month / health header integrated into card ── */}
        <div className={`flex items-center gap-3 px-3 py-2.5 -mx-1 rounded-xl border ${
          healthColor === 'emerald'
            ? 'bg-emerald-500/8 border-emerald-500/20'
            : healthColor === 'amber'
            ? 'bg-amber-500/8 border-amber-500/20'
            : 'bg-red-500/8 border-red-500/20'
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
            <p className="text-xs font-medium text-slate-400">Day {dayOfMonth}/{daysInMonth}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-16 h-1 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-slate-500 rounded-full" style={{ width: `${monthPct}%` }} />
              </div>
              <span className="text-[10px] text-slate-600">{monthPct}%</span>
            </div>
          </div>
        </div>

        {/* ── Header row: label + currency quick-toggle ── */}
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-slate-500 uppercase tracking-widest font-medium">Net this month</p>
          <div className="flex gap-1 bg-slate-900/70 rounded-lg p-0.5">
            {QUICK_CURRENCIES.map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                  currency === c
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-200'
                }`}
                aria-pressed={currency === c}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* ── Per-account breakdown (H2 rows) ── */}
        {accountStats.length > 0 && (
          <div className="space-y-2.5">
            {accountStats.map((acc) => (
              <div key={acc.id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: acc.color }}
                    aria-hidden="true"
                  />
                  <h2 className="text-sm font-medium text-slate-400 truncate">{acc.name}</h2>
                  <span className="text-[10px] text-slate-600 uppercase shrink-0">{acc.currency}</span>
                </div>
                <h2 className={`text-base font-semibold shrink-0 tabular-nums ${
                  acc.net > 0 ? 'text-emerald-400' : acc.net < 0 ? 'text-red-400' : 'text-slate-500'
                }`}>
                  {acc.net > 0 ? '+' : ''}{formatCurrency(acc.net, acc.currency)}
                </h2>
              </div>
            ))}
            {/* divider before total */}
            <div className="border-t border-slate-700/50" />
          </div>
        )}

        {/* ── Grand total (H1) ── */}
        <div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className={`text-[2.75rem] font-extrabold tracking-tight leading-none ${
              totalForCurrency >= 0 ? 'text-sky-400' : 'text-red-400'
            }`}>
              {totalForCurrency >= 0 ? '+' : ''}{formatCurrency(totalForCurrency, currency)}
            </h1>
            <div className="flex items-center gap-1.5">
              <TrendBadge current={totalForCurrency} prev={lastStats.net} />
              {lastStats.net !== 0 && (
                <span className="text-xs text-slate-600">vs {format(subMonths(now, 1), 'MMM')}</span>
              )}
            </div>
          </div>
          {accountsInCurrency.length === 0 && accountStats.length > 0 && (
            <p className="text-[11px] text-slate-600 mt-1">
              No {currency} accounts — add one in Settings to see a {currency} total
            </p>
          )}
        </div>

        {/* ── KPI row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <KpiCard label="Income" to="/transactions">
            <p className="text-lg font-bold text-emerald-400 mt-1 leading-none">{formatCurrency(stats.income, currency)}</p>
            <div className="mt-1.5"><TrendBadge current={stats.income} prev={lastStats.income} /></div>
          </KpiCard>
          <KpiCard label="Expenses" to="/transactions">
            <p className="text-lg font-bold text-red-400 mt-1 leading-none">{formatCurrency(stats.expenses, currency)}</p>
            <div className="mt-1.5"><TrendBadge current={stats.expenses} prev={lastStats.expenses} inverse /></div>
          </KpiCard>
          <KpiCard label="Savings rate" to="/insights">
            <p className={`text-lg font-bold mt-1 leading-none ${stats.savingsRate >= 20 ? 'text-emerald-400' : stats.savingsRate >= 10 ? 'text-amber-400' : 'text-red-400'}`}>
              {stats.savingsRate.toFixed(0)}%
            </p>
            <div className="mt-1.5"><TrendBadge current={stats.savingsRate} prev={lastStats.savingsRate} /></div>
          </KpiCard>
          <KpiCard label="Budget health" to="/budgets">
            {activeBudgets.length > 0 ? (
              <>
                <p className={`text-lg font-bold mt-1 leading-none ${
                  budgetsOnTrack === activeBudgets.length ? 'text-emerald-400'
                  : budgetsOnTrack >= activeBudgets.length / 2 ? 'text-amber-400'
                  : 'text-red-400'
                }`}>
                  {budgetsOnTrack}<span className="text-slate-600 font-normal text-base">/{activeBudgets.length}</span>
                </p>
                <p className="text-[11px] text-slate-500 mt-1">on track</p>
              </>
            ) : (
              <>
                <p className="text-lg font-bold text-slate-600 mt-1 leading-none">—</p>
                <p className="text-[11px] text-sky-400 mt-1">Set budgets</p>
              </>
            )}
          </KpiCard>
        </div>
      </div>

      {/* ── Quick-stats row: Monthly Subs + You Owe ── */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate('/subscriptions')}
          className="text-left bg-slate-800/60 hover:bg-slate-700/50 border border-slate-700/60 rounded-2xl p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          aria-label="View subscriptions"
        >
          <p className="text-[11px] text-slate-500 uppercase tracking-widest font-medium">Monthly subs</p>
          <p className="text-2xl font-bold text-amber-400 mt-1.5 leading-none">
            {formatCurrency(monthlySubCost, currency)}
          </p>
          <p className="text-xs text-slate-500 mt-1.5">{subscriptions.filter((s) => s.isActive).length} active subscriptions</p>
        </button>

        <button
          onClick={() => navigate('/loans')}
          className="text-left bg-slate-800/60 hover:bg-slate-700/50 border border-slate-700/60 rounded-2xl p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          aria-label="View loans you owe"
        >
          <p className="text-[11px] text-slate-500 uppercase tracking-widest font-medium">You owe</p>
          <p className={`text-2xl font-bold mt-1.5 leading-none ${totalBorrowed > 0 ? 'text-red-400' : 'text-slate-600'}`}>
            {totalBorrowed > 0 ? formatCurrency(totalBorrowed, currency) : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-1.5">
            {totalBorrowed > 0 ? `${activeLoans.filter((l) => l.direction === 'borrowed').length} active loan${activeLoans.filter((l) => l.direction === 'borrowed').length !== 1 ? 's' : ''}` : 'No active loans'}
          </p>
        </button>
      </div>

      {/* ── Upcoming bills (above chart) ── */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming bills</CardTitle>
          <Link to="/subscriptions" className="text-xs text-sky-400 hover:text-sky-300 transition-colors">Manage</Link>
        </CardHeader>
        <UpcomingBills />
      </Card>

      {/* ── Zone C: Income vs Expenses chart (full-width, prominent) ── */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Income vs Expenses</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Tap W · M · Q · Y to change period · ⋯ to compare</p>
          </div>
        </div>
        <div className="mt-3">
          <NetBalanceChart />
        </div>
      </div>

      {/* ── Zone D: Spending by category ── */}
      <Card>
        <CardHeader>
          <CardTitle>Spending by category</CardTitle>
          <span className="text-xs text-slate-500">This month</span>
        </CardHeader>
        <CategoryDonut />
      </Card>

      {/* ── Zone E: Goals summary ── */}
      {activeGoals.length > 0 && (
        <button
          onClick={() => navigate('/goals')}
          className="w-full text-left bg-slate-800/60 hover:bg-slate-700/50 border border-slate-700/60 rounded-2xl p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          aria-label="View financial goals"
        >
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <p className="text-sm font-semibold text-slate-200">Financial Goals</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{activeGoals.length} active · {goalsProgress.toFixed(0)}% overall</p>
            </div>
            <span className="text-xs text-sky-400">View all →</span>
          </div>
          <div className="w-full bg-slate-700/60 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full bg-gradient-to-r from-sky-500 to-sky-400 transition-all"
              style={{ width: `${Math.min(goalsProgress, 100)}%` }}
            />
          </div>
        </button>
      )}

      {/* ── Zone F: Insights ── */}
      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Insights</CardTitle>
            <Link to="/insights" className="text-xs text-sky-400 hover:text-sky-300 transition-colors">See all</Link>
          </CardHeader>
          <div className="space-y-2">
            {insights.slice(0, 3).map((insight) => (
              <InsightBanner key={insight.id} insight={insight} />
            ))}
          </div>
        </Card>
      )}

      {/* ── Zone H: Recent transactions ── */}
      <Card>
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
          <Link to="/transactions" className="text-xs text-sky-400 hover:text-sky-300 transition-colors">View all</Link>
        </CardHeader>
        {transactions.length === 0 ? (
          <div className="py-8 text-center space-y-3">
            <p className="text-slate-500 text-sm">No transactions yet.</p>
            <Link
              to="/transactions"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <span aria-hidden="true">+</span> Add your first transaction
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-slate-700/40" role="list">
            {transactions.slice(0, 5).map((txn) => {
              const todayStr = new Date().toISOString().split('T')[0];
              const isScheduled = txn.type === 'income' && txn.date > todayStr;
              return (
                <li key={txn.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm ${
                      isScheduled
                        ? 'bg-sky-500/15 text-sky-400'
                        : txn.type === 'income'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-red-500/15 text-red-400'
                    }`}>
                      {isScheduled ? '⏳' : txn.type === 'income' ? '↓' : '↑'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium text-slate-200 truncate">{txn.merchant ?? txn.category}</p>
                        {isScheduled && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide bg-sky-900/50 text-sky-400 ring-1 ring-sky-700 uppercase shrink-0">
                            Scheduled
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">{txn.category} · {txn.date}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ml-3 shrink-0 ${
                    isScheduled ? 'text-sky-400' : txn.type === 'income' ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {txn.type === 'income' ? '+' : '-'}{formatCurrency(txn.amountMinorUnits, txn.currency)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* bottom padding for mobile FAB */}
      <div className="h-4 lg:hidden" aria-hidden="true" />
    </div>
  );
}
