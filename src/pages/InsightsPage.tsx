import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { subMonths, startOfMonth, endOfMonth, format, isWithinInterval } from 'date-fns';
import { generateInsights, type Insight } from '../core/insights';
import { useTransactionStore } from '../store/useTransactionStore';
import { useSubscriptionStore } from '../store/useSubscriptionStore';
import { useLoanStore } from '../store/useLoanStore';
import { useBudgetStore } from '../store/useBudgetStore';
import { useGoalStore } from '../store/useGoalStore';
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

interface FinanceReport {
  savingsRate: number;
  income: number;
  expenses: number;
  subMonthlyTotal: number;
  subPctOfIncome: number;
  activeLoansCount: number;
  totalDebt: number;
  overdueLoansCount: number;
  budgetsTotal: number;
  budgetsOverCount: number;
  activeGoalsCount: number;
  goalsProgress: number;
}

function ReportCard({
  title,
  value,
  sub,
  color,
  to,
}: {
  title: string;
  value: string;
  sub?: string;
  color: 'green' | 'red' | 'amber' | 'sky' | 'slate';
  to: string;
}) {
  const colorMap = {
    green: 'text-emerald-400',
    red: 'text-red-400',
    amber: 'text-amber-400',
    sky: 'text-sky-400',
    slate: 'text-slate-300',
  };
  return (
    <Link
      to={to}
      className="block bg-slate-800 hover:bg-slate-700/70 border border-slate-700 rounded-xl p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
    >
      <p className="text-xs text-slate-500 uppercase tracking-wide">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${colorMap[color]}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </Link>
  );
}

function FinanceReportPanel({ report }: { report: FinanceReport }) {
  const tips: Array<{ text: string; severity: 'ok' | 'warn' | 'bad'; to: string }> = [];

  // Savings rate
  if (report.income === 0) {
    tips.push({ text: 'Add income transactions to see your savings rate.', severity: 'warn', to: '/transactions' });
  } else if (report.savingsRate < 0) {
    tips.push({ text: `You're spending ${Math.abs(report.savingsRate).toFixed(0)}% more than you earn. Reduce expenses or add income.`, severity: 'bad', to: '/transactions' });
  } else if (report.savingsRate < 10) {
    tips.push({ text: `Savings rate is ${report.savingsRate.toFixed(0)}%. Aim for 20%+ to build a financial cushion.`, severity: 'warn', to: '/insights' });
  } else if (report.savingsRate >= 20) {
    tips.push({ text: `Great savings rate of ${report.savingsRate.toFixed(0)}%! Consider putting surplus into goals or investments.`, severity: 'ok', to: '/goals' });
  }

  // Subscriptions
  if (report.income > 0 && report.subPctOfIncome > 25) {
    tips.push({ text: `Subscriptions are ${report.subPctOfIncome.toFixed(0)}% of income (${formatCurrency(report.subMonthlyTotal, 'GBP')}/mo). Consider cancelling unused ones.`, severity: 'bad', to: '/subscriptions' });
  } else if (report.income > 0 && report.subPctOfIncome > 15) {
    tips.push({ text: `Subscriptions are ${report.subPctOfIncome.toFixed(0)}% of income. Review to keep below 15%.`, severity: 'warn', to: '/subscriptions' });
  }

  // Loans
  if (report.overdueLoansCount > 0) {
    tips.push({ text: `${report.overdueLoansCount} overdue loan${report.overdueLoansCount > 1 ? 's' : ''}. Record payments or update due dates.`, severity: 'bad', to: '/loans' });
  } else if (report.activeLoansCount > 0) {
    tips.push({ text: `${report.activeLoansCount} active loan${report.activeLoansCount > 1 ? 's' : ''} totalling ${formatCurrency(report.totalDebt, 'GBP')}. Use the Avalanche or Snowball method below to pay efficiently.`, severity: 'warn', to: '/loans' });
  }

  // Budgets
  if (report.budgetsTotal === 0) {
    tips.push({ text: 'No budgets set. Create spending limits to control monthly expenses.', severity: 'warn', to: '/budgets' });
  } else if (report.budgetsOverCount > 0) {
    tips.push({ text: `${report.budgetsOverCount} of ${report.budgetsTotal} budgets exceeded this month.`, severity: 'bad', to: '/budgets' });
  } else {
    tips.push({ text: `All ${report.budgetsTotal} budgets on track.`, severity: 'ok', to: '/budgets' });
  }

  // Goals
  if (report.activeGoalsCount === 0) {
    tips.push({ text: 'No financial goals set. Setting targets motivates consistent saving.', severity: 'warn', to: '/goals' });
  } else if (report.goalsProgress > 75) {
    tips.push({ text: `${report.goalsProgress.toFixed(0)}% toward your goals — nearly there!`, severity: 'ok', to: '/goals' });
  }

  const severityStyle = {
    ok: { border: 'border-emerald-500/20 bg-emerald-500/5', text: 'text-emerald-300', dot: 'bg-emerald-400' },
    warn: { border: 'border-amber-500/20 bg-amber-500/5', text: 'text-amber-300', dot: 'bg-amber-400' },
    bad: { border: 'border-red-500/20 bg-red-500/8', text: 'text-red-300', dot: 'bg-red-400' },
  };

  return (
    <Card>
      <CardHeader><CardTitle>Finance Report</CardTitle><span className="text-xs text-slate-500">This month</span></CardHeader>
      <div className="space-y-2">
        {tips.map((tip, i) => {
          const s = severityStyle[tip.severity];
          return (
            <Link
              key={i}
              to={tip.to}
              className={`flex items-start gap-3 p-3 rounded-lg border ${s.border} hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500`}
            >
              <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
              <p className={`text-xs leading-relaxed ${s.text}`}>{tip.text}</p>
              <span className="ml-auto text-xs text-slate-500 shrink-0">→</span>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

export default function InsightsPage() {
  const { transactions, load: loadTxns } = useTransactionStore();
  const { subscriptions, load: loadSubs } = useSubscriptionStore();
  const { loans, load: loadLoans } = useLoanStore();
  const { budgets, load: loadBudgets } = useBudgetStore();
  const { goals, load: loadGoals } = useGoalStore();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthData[]>([]);
  const [topCategories, setTopCategories] = useState<Array<{ category: string; amount: number }>>([]);
  const [savingsRate, setSavingsRate] = useState(0);
  const [cashFlow, setCashFlow] = useState(0);
  const [report, setReport] = useState<FinanceReport>({
    savingsRate: 0, income: 0, expenses: 0,
    subMonthlyTotal: 0, subPctOfIncome: 0,
    activeLoansCount: 0, totalDebt: 0, overdueLoansCount: 0,
    budgetsTotal: 0, budgetsOverCount: 0,
    activeGoalsCount: 0, goalsProgress: 0,
  });

  useEffect(() => {
    loadTxns();
    loadSubs();
    loadLoans();
    loadBudgets();
    loadGoals();
  }, []);

  useEffect(() => {
    generateInsights().then(setInsights).catch(console.error);
    buildCharts();
  }, [transactions, subscriptions, loans]);

  useEffect(() => {
    buildReport();
  }, [transactions, subscriptions, loans, budgets, goals]);

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
    const now2 = new Date();
    const currentStart = startOfMonth(now2);
    const currentEnd = endOfMonth(now2);
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

  function buildReport() {
    const now = new Date();
    const currentStart = startOfMonth(now);
    const currentEnd = endOfMonth(now);
    const currentTxns = transactions.filter(
      (t) => !t.deletedAt && isWithinInterval(new Date(t.date), { start: currentStart, end: currentEnd }),
    );
    const income = currentTxns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amountMinorUnits, 0);
    const expenses = currentTxns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amountMinorUnits, 0);
    const sr = income > 0 ? ((income - expenses) / income) * 100 : 0;

    const activeSubs = subscriptions.filter((s) => s.isActive && !s.deletedAt);
    const subMonthlyTotal = activeSubs.reduce((s, sub) => {
      const monthly =
        sub.billingCycle === 'weekly' ? sub.amountMinorUnits * 4.33
        : sub.billingCycle === 'quarterly' ? sub.amountMinorUnits / 3
        : sub.billingCycle === 'annual' ? sub.amountMinorUnits / 12
        : sub.amountMinorUnits;
      return s + monthly;
    }, 0);

    const activeLoans = loans.filter((l) => l.status !== 'settled' && !l.deletedAt);
    const overdueLoans = activeLoans.filter((l) => l.dueDate && new Date(l.dueDate) < now);
    const totalDebt = activeLoans.reduce((s, l) => s + l.remainingMinorUnits, 0);

    const activeBudgets = budgets.filter((b) => b.isActive && !b.deletedAt);
    const spentByCategory: Record<string, number> = {};
    for (const t of currentTxns.filter((t) => t.type === 'expense')) {
      spentByCategory[t.category] = (spentByCategory[t.category] ?? 0) + t.amountMinorUnits;
    }
    const budgetsOver = activeBudgets.filter((b) => (spentByCategory[b.category] ?? 0) > b.amountMinorUnits);

    const activeGoals = goals.filter((g) => !g.isAchieved && !g.deletedAt);
    const totalTarget = activeGoals.reduce((s, g) => s + g.targetMinorUnits, 0);
    const totalCurrent = activeGoals.reduce((s, g) => s + g.currentMinorUnits, 0);

    setReport({
      savingsRate: sr,
      income,
      expenses,
      subMonthlyTotal,
      subPctOfIncome: income > 0 ? (subMonthlyTotal / income) * 100 : 0,
      activeLoansCount: activeLoans.length,
      totalDebt,
      overdueLoansCount: overdueLoans.length,
      budgetsTotal: activeBudgets.length,
      budgetsOverCount: budgetsOver.length,
      activeGoalsCount: activeGoals.length,
      goalsProgress: totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0,
    });
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

      {/* KPIs — all clickable links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <ReportCard
          title="Savings Rate"
          value={`${savingsRate.toFixed(1)}%`}
          sub="Target: 20%+"
          color={savingsRate >= 20 ? 'green' : savingsRate >= 10 ? 'amber' : 'red'}
          to="/transactions"
        />
        <ReportCard
          title="Projected Cash Flow"
          value={formatCurrency(cashFlow, 'GBP')}
          sub="Income minus subs"
          color={cashFlow >= 0 ? 'green' : 'red'}
          to="/subscriptions"
        />
        <ReportCard
          title="Active Loans"
          value={String(activeLoans.length)}
          sub={activeLoans.length > 0 ? `${formatCurrency(activeLoans.reduce((s, l) => s + l.remainingMinorUnits, 0), 'GBP')} total` : 'No active loans'}
          color={activeLoans.length === 0 ? 'green' : 'amber'}
          to="/loans"
        />
      </div>

      {/* Finance Report — comprehensive guidance */}
      <FinanceReportPanel report={report} />

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
