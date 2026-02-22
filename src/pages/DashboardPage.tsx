import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { db } from '../core/db';
import { formatCurrency, toMajor } from '../core/types';
import { generateInsights, type Insight } from '../core/insights';
import { useAccountStore } from '../store/useAccountStore';
import { useTransactionStore } from '../store/useTransactionStore';
import { useSubscriptionStore } from '../store/useSubscriptionStore';
import { useLoanStore } from '../store/useLoanStore';
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
        <Link
          to={insight.actionRoute}
          className="shrink-0 text-xs text-sky-400 hover:text-sky-300 transition-colors"
        >
          View →
        </Link>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { accounts, load: loadAccounts } = useAccountStore();
  const { transactions, load: loadTransactions } = useTransactionStore();
  const { subscriptions, load: loadSubscriptions } = useSubscriptionStore();
  const { loans, load: loadLoans } = useLoanStore();
  const [stats, setStats] = useState<MonthStats>({ income: 0, expenses: 0, net: 0, savingsRate: 0 });
  const [insights, setInsights] = useState<Insight[]>([]);

  useEffect(() => {
    loadAccounts();
    loadTransactions();
    loadSubscriptions();
    loadLoans();
  }, []);

  useEffect(() => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);

    const monthTxns = transactions.filter(
      (t) =>
        !t.deletedAt &&
        isWithinInterval(new Date(t.date), { start, end }),
    );

    const income = monthTxns
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amountMinorUnits, 0);
    const expenses = monthTxns
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amountMinorUnits, 0);

    setStats({
      income,
      expenses,
      net: income - expenses,
      savingsRate: income > 0 ? ((income - expenses) / income) * 100 : 0,
    });
  }, [transactions]);

  useEffect(() => {
    generateInsights().then(setInsights).catch(console.error);
  }, [transactions, subscriptions, loans]);

  const totalBalance = accounts
    .filter((a) => !a.isArchived && !a.deletedAt)
    .reduce((s) => s, 0);

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

  const currency = accounts[0]?.currency ?? 'GBP';

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-100">
          {format(new Date(), 'MMMM yyyy')}
        </h1>
        <p className="text-slate-400 text-sm mt-0.5">Your financial snapshot</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Income</p>
          <p className="text-lg font-bold text-emerald-400 mt-1">
            {formatCurrency(stats.income, currency)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Expenses</p>
          <p className="text-lg font-bold text-red-400 mt-1">
            {formatCurrency(stats.expenses, currency)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Net</p>
          <p className={`text-lg font-bold mt-1 ${stats.net >= 0 ? 'text-sky-400' : 'text-red-400'}`}>
            {formatCurrency(stats.net, currency)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Savings rate</p>
          <p className={`text-lg font-bold mt-1 ${stats.savingsRate >= 20 ? 'text-emerald-400' : stats.savingsRate >= 10 ? 'text-amber-400' : 'text-red-400'}`}>
            {stats.savingsRate.toFixed(0)}%
          </p>
        </Card>
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Monthly subscriptions</p>
          <p className="text-base font-semibold text-amber-400 mt-1">
            {formatCurrency(monthlySubCost, currency)}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{subscriptions.filter((s) => s.isActive).length} active</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Money owed to you</p>
          <p className="text-base font-semibold text-emerald-400 mt-1">
            {formatCurrency(totalOwed, currency)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500 uppercase tracking-wide">You owe</p>
          <p className="text-base font-semibold text-red-400 mt-1">
            {formatCurrency(totalBorrowed, currency)}
          </p>
        </Card>
      </div>

      {/* Charts */}
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

      {/* Insights + upcoming bills */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Insights */}
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

        {/* Upcoming bills */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming bills</CardTitle>
            <Link to="/subscriptions" className="text-xs text-sky-400 hover:text-sky-300">Manage</Link>
          </CardHeader>
          <UpcomingBills />
        </Card>
      </div>

      {/* Recent transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
          <Link to="/transactions" className="text-xs text-sky-400 hover:text-sky-300">View all</Link>
        </CardHeader>
        {transactions.length === 0 ? (
          <p className="text-slate-500 text-sm">No transactions yet. <Link to="/transactions" className="text-sky-400 hover:underline">Add your first one →</Link></p>
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
