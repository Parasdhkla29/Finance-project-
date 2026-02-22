import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { subMonths, startOfMonth, endOfMonth, format, isWithinInterval } from 'date-fns';
import { generateInsights, type Insight } from '../core/insights';
import { useTransactionStore } from '../store/useTransactionStore';
import { useSubscriptionStore } from '../store/useSubscriptionStore';
import { useLoanStore } from '../store/useLoanStore';
import { formatCurrency, toMajor } from '../core/types';
import { db } from '../core/db';
import Card, { CardHeader, CardTitle } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { Link } from 'react-router-dom';

interface MonthData {
  month: string;
  income: number;
  expenses: number;
  savings: number;
}

const INSIGHT_COLORS: Record<Insight['type'], 'warning' | 'success' | 'info' | 'danger'> = {
  warning: 'warning',
  suggestion: 'info',
  info: 'info',
  success: 'success',
};

export default function InsightsPage() {
  const { transactions, load: loadTxns } = useTransactionStore();
  const { subscriptions, load: loadSubs } = useSubscriptionStore();
  const { loans, load: loadLoans } = useLoanStore();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthData[]>([]);
  const [topCategories, setTopCategories] = useState<Array<{ category: string; amount: number }>>([]);
  const [savingsRate, setSavingsRate] = useState(0);
  const [cashFlow, setCashFlow] = useState(0);

  useEffect(() => {
    loadTxns();
    loadSubs();
    loadLoans();
  }, []);

  useEffect(() => {
    generateInsights().then(setInsights).catch(console.error);
    buildCharts();
  }, [transactions, subscriptions, loans]);

  async function buildCharts() {
    const now = new Date();
    const points: MonthData[] = [];

    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);

      const txns = await db.transactions
        .filter(
          (t) => !t.deletedAt && isWithinInterval(new Date(t.date), { start, end }),
        )
        .toArray();

      const income = txns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amountMinorUnits, 0);
      const expenses = txns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amountMinorUnits, 0);

      points.push({
        month: format(monthDate, 'MMM'),
        income: toMajor(income),
        expenses: toMajor(expenses),
        savings: toMajor(income - expenses),
      });
    }

    setMonthlyData(points);

    // Current month stats
    const currentStart = startOfMonth(now);
    const currentEnd = endOfMonth(now);
    const currentTxns = transactions.filter(
      (t) => !t.deletedAt && isWithinInterval(new Date(t.date), { start: currentStart, end: currentEnd }),
    );
    const income = currentTxns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amountMinorUnits, 0);
    const expenses = currentTxns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amountMinorUnits, 0);

    setSavingsRate(income > 0 ? ((income - expenses) / income) * 100 : 0);

    // Top categories
    const catMap: Record<string, number> = {};
    for (const t of currentTxns.filter((t) => t.type === 'expense')) {
      catMap[t.category] = (catMap[t.category] ?? 0) + t.amountMinorUnits;
    }
    const cats = Object.entries(catMap)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
    setTopCategories(cats);

    // Cash flow: avg income - fixed subs next 30 days
    const totalIncome = currentTxns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amountMinorUnits, 0);
    const monthSubs = subscriptions
      .filter((s) => s.isActive && !s.deletedAt)
      .reduce((s, sub) => {
        const monthly =
          sub.billingCycle === 'weekly' ? sub.amountMinorUnits * 4.33
          : sub.billingCycle === 'quarterly' ? sub.amountMinorUnits / 3
          : sub.billingCycle === 'annual' ? sub.amountMinorUnits / 12
          : sub.amountMinorUnits;
        return s + monthly;
      }, 0);
    setCashFlow(totalIncome - monthSubs);
  }

  // Debt payoff order (avalanche = highest interest first)
  const activeLoans = loans.filter((l) => l.status !== 'settled' && !l.deletedAt);
  const avalanche = [...activeLoans].sort(
    (a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0),
  );
  const snowball = [...activeLoans].sort(
    (a, b) => a.remainingMinorUnits - b.remainingMinorUnits,
  );

  const CHART_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-slate-100">Insights & Analytics</h1>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Savings Rate</p>
          <p className={`text-2xl font-bold mt-1 ${savingsRate >= 20 ? 'text-emerald-400' : savingsRate >= 10 ? 'text-amber-400' : 'text-red-400'}`}>
            {savingsRate.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-500 mt-1">Target: 20%+</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Projected Cash Flow</p>
          <p className={`text-xl font-bold mt-1 ${cashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatCurrency(cashFlow, 'GBP')}
          </p>
          <p className="text-xs text-slate-500 mt-1">Income minus subs</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Active Loans</p>
          <p className="text-2xl font-bold text-slate-100 mt-1">{activeLoans.length}</p>
          <p className="text-xs text-slate-500 mt-1">
            {formatCurrency(activeLoans.reduce((s, l) => s + l.remainingMinorUnits, 0), 'GBP')} total
          </p>
        </Card>
      </div>

      {/* All insights */}
      {insights.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Smart Alerts</CardTitle></CardHeader>
          <div className="space-y-3">
            {insights.map((insight) => (
              <div key={insight.id} className="flex items-start gap-3 p-3 bg-slate-900 rounded-xl border border-slate-700">
                <Badge variant={INSIGHT_COLORS[insight.type]} className="mt-0.5 shrink-0">
                  {insight.type === 'warning' ? '!' : insight.type === 'success' ? '✓' : 'i'}
                </Badge>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-200">{insight.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{insight.description}</p>
                </div>
                {insight.actionRoute && (
                  <Link to={insight.actionRoute} className="shrink-0 text-xs text-sky-400 hover:text-sky-300">
                    View →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Monthly income vs expenses bar chart */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Cash Flow</CardTitle>
          <span className="text-xs text-slate-500">Last 6 months</span>
        </CardHeader>
        <div aria-label="Monthly income vs expenses bar chart">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${v}`} width={55} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(value: number | undefined, name: string | undefined) => [`£${(value ?? 0).toFixed(2)}`, (name ?? '').charAt(0).toUpperCase() + (name ?? '').slice(1)] as [string, string]}
              />
              <Bar dataKey="income" fill="#10b981" name="income" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" fill="#ef4444" name="expenses" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Top spending categories */}
      {topCategories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Spending Categories</CardTitle>
            <span className="text-xs text-slate-500">This month</span>
          </CardHeader>
          <div className="space-y-3">
            {topCategories.map((cat, i) => {
              const max = topCategories[0].amount;
              const pct = (cat.amount / max) * 100;
              return (
                <div key={cat.category}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">{cat.category}</span>
                    <span className="text-slate-400">{formatCurrency(cat.amount, 'GBP')}</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Debt payoff planner */}
      {activeLoans.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Avalanche Method</CardTitle>
            </CardHeader>
            <p className="text-xs text-slate-500 mb-3">Pay highest interest rate first — minimises total interest paid.</p>
            <ol className="space-y-2">
              {avalanche.map((loan, i) => (
                <li key={loan.id} className="flex items-center gap-2 text-sm">
                  <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-400 flex items-center justify-center text-xs shrink-0">{i + 1}</span>
                  <span className="text-slate-200 truncate">{loan.counterparty}</span>
                  <span className="ml-auto text-slate-400 text-xs shrink-0">
                    {loan.interestRate ?? 0}% · {formatCurrency(loan.remainingMinorUnits, loan.currency)}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Snowball Method</CardTitle>
            </CardHeader>
            <p className="text-xs text-slate-500 mb-3">Pay smallest balance first — builds momentum and motivation.</p>
            <ol className="space-y-2">
              {snowball.map((loan, i) => (
                <li key={loan.id} className="flex items-center gap-2 text-sm">
                  <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-400 flex items-center justify-center text-xs shrink-0">{i + 1}</span>
                  <span className="text-slate-200 truncate">{loan.counterparty}</span>
                  <span className="ml-auto text-slate-400 text-xs shrink-0">
                    {formatCurrency(loan.remainingMinorUnits, loan.currency)}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      )}
    </div>
  );
}
