import { useEffect, useRef, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  subDays,
  subMonths,
  subWeeks,
  subYears,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfYear,
  endOfYear,
  startOfQuarter,
  endOfQuarter,
  subQuarters,
  format,
  isWithinInterval,
} from 'date-fns';
import { db } from '../../core/db';
import { toMajor } from '../../core/types';

type Period = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

interface ChartPoint {
  label: string;
  income: number;
  expenses: number;
  pastIncome?: number;
  pastExpenses?: number;
}

// ── helpers ──────────────────────────────────────────────────────────────────

async function fetchRange(start: Date, end: Date) {
  return db.transactions
    .filter((t) => !t.deletedAt && isWithinInterval(new Date(t.date), { start, end }))
    .toArray();
}

function sumBy(txns: Awaited<ReturnType<typeof fetchRange>>, type: 'income' | 'expense') {
  return toMajor(
    txns.filter((t) => t.type === type).reduce((s, t) => s + t.amountMinorUnits, 0),
  );
}

// ── custom tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const map: Record<string, string> = {
    income: 'Income',
    expenses: 'Expenses',
    pastIncome: 'Past income',
    pastExpenses: 'Past expenses',
  };
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 shadow-xl">
      <p className="text-xs font-semibold text-slate-300 mb-1.5">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.color }} />
          <span className="text-slate-400">{map[entry.dataKey] ?? entry.dataKey}:</span>
          <span className="text-slate-100 font-medium ml-auto pl-3">£{(entry.value ?? 0).toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function NetBalanceChart() {
  const [period, setPeriod] = useState<Period>('weekly');
  const [showComparison, setShowComparison] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [data, setData] = useState<ChartPoint[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  // close menu on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  useEffect(() => {
    async function load() {
      const now = new Date();
      const points: ChartPoint[] = [];

      if (period === 'daily') {
        // Last 14 days
        for (let i = 13; i >= 0; i--) {
          const day = subDays(now, i);
          const start = startOfDay(day);
          const end = endOfDay(day);
          const txns = await fetchRange(start, end);

          let pastIncome: number | undefined;
          let pastExpenses: number | undefined;
          if (showComparison) {
            const pDay = subDays(day, 14);
            const past = await fetchRange(startOfDay(pDay), endOfDay(pDay));
            pastIncome = sumBy(past, 'income');
            pastExpenses = sumBy(past, 'expense');
          }

          points.push({
            label: format(day, 'MMM d'),
            income: sumBy(txns, 'income'),
            expenses: sumBy(txns, 'expense'),
            pastIncome,
            pastExpenses,
          });
        }
      } else if (period === 'weekly') {
        // 8 weeks ending this week
        for (let i = 7; i >= 0; i--) {
          const wDate = subWeeks(now, i);
          const start = startOfWeek(wDate, { weekStartsOn: 1 });
          const end = endOfWeek(wDate, { weekStartsOn: 1 });
          const txns = await fetchRange(start, end);

          let pastIncome: number | undefined;
          let pastExpenses: number | undefined;
          if (showComparison) {
            const pStart = startOfWeek(subWeeks(wDate, 8), { weekStartsOn: 1 });
            const pEnd = endOfWeek(subWeeks(wDate, 8), { weekStartsOn: 1 });
            const past = await fetchRange(pStart, pEnd);
            pastIncome = sumBy(past, 'income');
            pastExpenses = sumBy(past, 'expense');
          }

          points.push({
            label: format(start, 'MMM d'),
            income: sumBy(txns, 'income'),
            expenses: sumBy(txns, 'expense'),
            pastIncome,
            pastExpenses,
          });
        }
      } else if (period === 'monthly') {
        // 6 months ending this month
        for (let i = 5; i >= 0; i--) {
          const mDate = subMonths(now, i);
          const start = startOfMonth(mDate);
          const end = endOfMonth(mDate);
          const txns = await fetchRange(start, end);

          let pastIncome: number | undefined;
          let pastExpenses: number | undefined;
          if (showComparison) {
            const pDate = subMonths(mDate, 6);
            const past = await fetchRange(startOfMonth(pDate), endOfMonth(pDate));
            pastIncome = sumBy(past, 'income');
            pastExpenses = sumBy(past, 'expense');
          }

          points.push({
            label: format(mDate, 'MMM'),
            income: sumBy(txns, 'income'),
            expenses: sumBy(txns, 'expense'),
            pastIncome,
            pastExpenses,
          });
        }
      } else if (period === 'quarterly') {
        // 6 quarters ending this quarter
        for (let i = 5; i >= 0; i--) {
          const qDate = subQuarters(now, i);
          const start = startOfQuarter(qDate);
          const end = endOfQuarter(qDate);
          const txns = await fetchRange(start, end);

          const q = Math.floor(qDate.getMonth() / 3) + 1;
          const yr = format(qDate, 'yy');

          let pastIncome: number | undefined;
          let pastExpenses: number | undefined;
          if (showComparison) {
            const pDate = subQuarters(qDate, 6);
            const past = await fetchRange(startOfQuarter(pDate), endOfQuarter(pDate));
            pastIncome = sumBy(past, 'income');
            pastExpenses = sumBy(past, 'expense');
          }

          points.push({
            label: `Q${q} '${yr}`,
            income: sumBy(txns, 'income'),
            expenses: sumBy(txns, 'expense'),
            pastIncome,
            pastExpenses,
          });
        }
      } else {
        // 4 years ending this year
        for (let i = 3; i >= 0; i--) {
          const yDate = subYears(now, i);
          const start = startOfYear(yDate);
          const end = endOfYear(yDate);
          const txns = await fetchRange(start, end);

          let pastIncome: number | undefined;
          let pastExpenses: number | undefined;
          if (showComparison) {
            const pDate = subYears(yDate, 4);
            const past = await fetchRange(startOfYear(pDate), endOfYear(pDate));
            pastIncome = sumBy(past, 'income');
            pastExpenses = sumBy(past, 'expense');
          }

          points.push({
            label: format(yDate, 'yyyy'),
            income: sumBy(txns, 'income'),
            expenses: sumBy(txns, 'expense'),
            pastIncome,
            pastExpenses,
          });
        }
      }

      setData(points);
    }
    load();
  }, [period, showComparison]);

  const periods: { key: Period; label: string }[] = [
    { key: 'daily', label: 'D' },
    { key: 'weekly', label: 'W' },
    { key: 'monthly', label: 'M' },
    { key: 'quarterly', label: 'Q' },
    { key: 'yearly', label: 'Y' },
  ];

  const totalIncome = data.reduce((s, d) => s + d.income, 0);
  const totalExpenses = data.reduce((s, d) => s + d.expenses, 0);

  const maxBarSize = period === 'daily' ? 12 : period === 'weekly' ? 20 : 28;

  return (
    <div>
      {/* Controls row */}
      <div className="flex items-center justify-between mb-4">
        {/* Period filter pills */}
        <div className="flex gap-1 bg-slate-900/60 rounded-lg p-1">
          {periods.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                period === key
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-200'
              }`}
              aria-pressed={period === key}
              aria-label={key}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Legend + three-dot menu */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-3">
            <LegendDot color="#10b981" label="Income" />
            <LegendDot color="#ef4444" label="Expenses" />
            {showComparison && (
              <>
                <LegendDot color="#a78bfa" label="Past income" />
                <LegendDot color="#fb923c" label="Past expenses" />
              </>
            )}
          </div>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className={`p-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                menuOpen ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-200 hover:bg-slate-700/60'
              }`}
              aria-label="Chart options"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                <circle cx="3" cy="8" r="1.4" />
                <circle cx="8" cy="8" r="1.4" />
                <circle cx="13" cy="8" r="1.4" />
              </svg>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-slate-800 border border-slate-700/80 rounded-xl shadow-2xl z-20 overflow-hidden">
                <div className="px-3 pt-2.5 pb-1">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Chart options</p>
                </div>
                <button
                  onClick={() => { setShowComparison((v) => !v); setMenuOpen(false); }}
                  className="flex items-center justify-between w-full px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-700/40 transition-colors"
                >
                  <div>
                    <p className="font-medium">Compare past period</p>
                    <p className="text-xs text-slate-500 mt-0.5">Show prev. equivalent range</p>
                  </div>
                  <div
                    className={`relative ml-3 w-9 h-5 rounded-full transition-colors shrink-0 ${
                      showComparison ? 'bg-sky-500' : 'bg-slate-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        showComparison ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </button>
                <div className="border-t border-slate-700/60 mx-3 mb-1" />
                <p className="px-3 pb-2.5 text-[10px] text-slate-600 leading-relaxed">
                  Past data shown as faded bars in violet & orange.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile legend */}
      <div className="flex sm:hidden flex-wrap items-center gap-2.5 mb-3">
        <LegendDot color="#10b981" label="Income" />
        <LegendDot color="#ef4444" label="Expenses" />
        {showComparison && (
          <>
            <LegendDot color="#a78bfa" label="Past inc." />
            <LegendDot color="#fb923c" label="Past exp." />
          </>
        )}
      </div>

      {/* Bar Chart */}
      <div aria-label={`${period} income vs expenses chart`}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="25%" barGap={2}>
            <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#475569', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={period === 'daily' ? 1 : 0}
            />
            <YAxis
              tick={{ fill: '#475569', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `£${v}`}
              width={44}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b', radius: 4 }} />

            {/* Past period bars (rendered first — behind current) */}
            {showComparison && (
              <>
                <Bar dataKey="pastIncome" fill="#a78bfa" fillOpacity={0.45} radius={[3, 3, 0, 0]} maxBarSize={maxBarSize} name="pastIncome" />
                <Bar dataKey="pastExpenses" fill="#fb923c" fillOpacity={0.45} radius={[3, 3, 0, 0]} maxBarSize={maxBarSize} name="pastExpenses" />
              </>
            )}

            {/* Current period bars */}
            <Bar dataKey="income" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={maxBarSize} name="income" />
            <Bar dataKey="expenses" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={maxBarSize} name="expenses" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Income / Expense totals below chart ── */}
      <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-700/50">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">Income</p>
          <p className="text-2xl font-bold text-emerald-400 tabular-nums mt-1">
            £{totalIncome.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">Expenses</p>
          <p className="text-2xl font-bold text-red-400 tabular-nums mt-1">
            £{totalExpenses.toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── small legend dot ──────────────────────────────────────────────────────────

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: color }} />
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}
