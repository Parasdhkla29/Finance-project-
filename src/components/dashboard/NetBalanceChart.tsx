import { useEffect, useRef, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  subMonths,
  subWeeks,
  subYears,
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

type Period = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

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

      if (period === 'weekly') {
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
    { key: 'weekly', label: 'W' },
    { key: 'monthly', label: 'M' },
    { key: 'quarterly', label: 'Q' },
    { key: 'yearly', label: 'Y' },
  ];

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
                <LegendDot color="#a78bfa" label="Past income" dashed />
                <LegendDot color="#fb923c" label="Past expenses" dashed />
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
                  {/* Toggle */}
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
                  Past data shown as faded dashed lines in violet & orange.
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
            <LegendDot color="#a78bfa" label="Past inc." dashed />
            <LegendDot color="#fb923c" label="Past exp." dashed />
          </>
        )}
      </div>

      {/* Chart */}
      <div aria-label={`${period} income vs expenses chart`}>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gExpenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gPastIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.14} />
                <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gPastExpenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fb923c" stopOpacity={0.14} />
                <stop offset="100%" stopColor="#fb923c" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#475569', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#475569', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `£${v}`}
              width={44}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Past period (rendered first — behind current) */}
            {showComparison && (
              <>
                <Area
                  type="monotone"
                  dataKey="pastIncome"
                  stroke="#a78bfa"
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  fill="url(#gPastIncome)"
                  strokeOpacity={0.7}
                  dot={false}
                  activeDot={{ r: 3, fill: '#a78bfa' }}
                  name="pastIncome"
                />
                <Area
                  type="monotone"
                  dataKey="pastExpenses"
                  stroke="#fb923c"
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  fill="url(#gPastExpenses)"
                  strokeOpacity={0.7}
                  dot={false}
                  activeDot={{ r: 3, fill: '#fb923c' }}
                  name="pastExpenses"
                />
              </>
            )}

            {/* Current period */}
            <Area
              type="monotone"
              dataKey="income"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#gIncome)"
              dot={false}
              activeDot={{ r: 4, fill: '#10b981', stroke: '#0f172a', strokeWidth: 2 }}
              name="income"
            />
            <Area
              type="monotone"
              dataKey="expenses"
              stroke="#ef4444"
              strokeWidth={2}
              fill="url(#gExpenses)"
              dot={false}
              activeDot={{ r: 4, fill: '#ef4444', stroke: '#0f172a', strokeWidth: 2 }}
              name="expenses"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── small legend dot ──────────────────────────────────────────────────────────

function LegendDot({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {dashed ? (
        <svg width="14" height="2" viewBox="0 0 14 2" aria-hidden="true">
          <line x1="0" y1="1" x2="14" y2="1" stroke={color} strokeWidth="2" strokeDasharray="4 2" />
        </svg>
      ) : (
        <span className="w-3 h-0.5 rounded" style={{ background: color }} />
      )}
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}
