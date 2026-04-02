import { useEffect, useRef, useState } from 'react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  addDays,
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
  parseISO,
  differenceInDays,
  isAfter,
  isBefore,
  isWithinInterval,
  isFuture as isDateFuture,
} from 'date-fns';
import { db } from '../../core/db';
import { toMajor } from '../../core/types';

type Period = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';

interface ChartPoint {
  label: string;
  displayDate: string;
  income: number;
  expenses: number;
  isFutureDay?: boolean;
  pastIncome?: number;
  pastExpenses?: number;
}

// ── helpers ───────────────────────────────────────────────────────────────────

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

// ── custom tooltip ─────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const map: Record<string, string> = {
    income: 'Income', expenses: 'Expenses',
    pastIncome: 'Past income', pastExpenses: 'Past expenses',
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

// ── main component ─────────────────────────────────────────────────────────────

export default function NetBalanceChart() {
  const [period, setPeriod] = useState<Period>('daily');
  const [showComparison, setShowComparison] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [data, setData] = useState<ChartPoint[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  // Custom range
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [customDraft, setCustomDraft] = useState({ start: '', end: '' });
  const menuRef = useRef<HTMLDivElement>(null);
  // Tracks whether today has been auto-selected for the current daily load
  const autoSelectedRef = useRef(false);

  // When period changes: clear selection + reset auto-select flag
  useEffect(() => {
    setSelectedLabel(null);
    autoSelectedRef.current = false;
  }, [period]);

  // After daily data loads: auto-select today (only once per period switch)
  useEffect(() => {
    if (period === 'daily' && data.length > 0 && !autoSelectedRef.current) {
      autoSelectedRef.current = true;
      const todayLabel = format(new Date(), 'EEE');
      if (data.some((d) => d.label === todayLabel)) {
        setSelectedLabel(todayLabel);
      }
    }
  }, [data, period]);

  // Close menu on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  // ── data loading ─────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const now = new Date();
      const points: ChartPoint[] = [];

      if (period === 'daily') {
        // Current calendar week Mon–Sun (7 bars).
        // Future days show scheduled income so users can see what's coming.
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        for (let i = 0; i < 7; i++) {
          const day = addDays(weekStart, i);
          const txns = await fetchRange(startOfDay(day), endOfDay(day));
          const futureDay = isDateFuture(endOfDay(day));

          let pastIncome: number | undefined;
          let pastExpenses: number | undefined;
          if (showComparison) {
            const same = subDays(day, 7);
            const past = await fetchRange(startOfDay(same), endOfDay(same));
            pastIncome = sumBy(past, 'income');
            pastExpenses = sumBy(past, 'expense');
          }

          points.push({
            label: format(day, 'EEE'),
            displayDate: format(day, 'EEEE, MMM d'),
            income: sumBy(txns, 'income'),
            expenses: sumBy(txns, 'expense'),
            isFutureDay: futureDay,
            pastIncome,
            pastExpenses,
          });
        }

      } else if (period === 'weekly') {
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
            displayDate: `Week of ${format(start, 'MMM d')}`,
            income: sumBy(txns, 'income'),
            expenses: sumBy(txns, 'expense'),
            pastIncome,
            pastExpenses,
          });
        }

      } else if (period === 'monthly') {
        for (let i = 5; i >= 0; i--) {
          const mDate = subMonths(now, i);
          const txns = await fetchRange(startOfMonth(mDate), endOfMonth(mDate));

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
            displayDate: format(mDate, 'MMMM yyyy'),
            income: sumBy(txns, 'income'),
            expenses: sumBy(txns, 'expense'),
            pastIncome,
            pastExpenses,
          });
        }

      } else if (period === 'quarterly') {
        for (let i = 5; i >= 0; i--) {
          const qDate = subQuarters(now, i);
          const txns = await fetchRange(startOfQuarter(qDate), endOfQuarter(qDate));
          const q = Math.floor(qDate.getMonth() / 3) + 1;

          let pastIncome: number | undefined;
          let pastExpenses: number | undefined;
          if (showComparison) {
            const pDate = subQuarters(qDate, 6);
            const past = await fetchRange(startOfQuarter(pDate), endOfQuarter(pDate));
            pastIncome = sumBy(past, 'income');
            pastExpenses = sumBy(past, 'expense');
          }

          points.push({
            label: `Q${q} '${format(qDate, 'yy')}`,
            displayDate: `Q${q} ${format(qDate, 'yyyy')}`,
            income: sumBy(txns, 'income'),
            expenses: sumBy(txns, 'expense'),
            pastIncome,
            pastExpenses,
          });
        }

      } else if (period === 'yearly') {
        for (let i = 3; i >= 0; i--) {
          const yDate = subYears(now, i);
          const txns = await fetchRange(startOfYear(yDate), endOfYear(yDate));

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
            displayDate: format(yDate, 'yyyy'),
            income: sumBy(txns, 'income'),
            expenses: sumBy(txns, 'expense'),
            pastIncome,
            pastExpenses,
          });
        }

      } else if (period === 'custom' && customStart && customEnd) {
        const rangeStart = parseISO(customStart);
        const rangeEnd = parseISO(customEnd);
        if (isBefore(rangeEnd, rangeStart)) { setData([]); return; }

        const dayCount = differenceInDays(rangeEnd, rangeStart) + 1;

        if (dayCount <= 31) {
          // Daily bars
          for (let i = 0; i < dayCount; i++) {
            const day = addDays(rangeStart, i);
            const txns = await fetchRange(startOfDay(day), endOfDay(day));
            points.push({
              label: dayCount <= 7 ? format(day, 'EEE') : format(day, 'MMM d'),
              displayDate: format(day, 'EEEE, MMM d'),
              income: sumBy(txns, 'income'),
              expenses: sumBy(txns, 'expense'),
              isFutureDay: isDateFuture(endOfDay(day)),
            });
          }
        } else if (dayCount <= 365) {
          // Weekly bars
          let current = startOfWeek(rangeStart, { weekStartsOn: 1 });
          while (!isAfter(current, rangeEnd)) {
            const weekEnd = endOfWeek(current, { weekStartsOn: 1 });
            const sliceStart = isBefore(current, rangeStart) ? rangeStart : current;
            const sliceEnd = isAfter(weekEnd, rangeEnd) ? rangeEnd : weekEnd;
            const txns = await fetchRange(startOfDay(sliceStart), endOfDay(sliceEnd));
            points.push({
              label: format(sliceStart, 'MMM d'),
              displayDate: `Week of ${format(sliceStart, 'MMM d')}`,
              income: sumBy(txns, 'income'),
              expenses: sumBy(txns, 'expense'),
            });
            current = addDays(weekEnd, 1);
          }
        } else {
          // Monthly bars
          let current = startOfMonth(rangeStart);
          while (!isAfter(current, rangeEnd)) {
            const monthEnd = endOfMonth(current);
            const sliceStart = isBefore(current, rangeStart) ? rangeStart : current;
            const sliceEnd = isAfter(monthEnd, rangeEnd) ? rangeEnd : monthEnd;
            const txns = await fetchRange(startOfDay(sliceStart), endOfDay(sliceEnd));
            points.push({
              label: format(current, 'MMM yy'),
              displayDate: format(current, 'MMMM yyyy'),
              income: sumBy(txns, 'income'),
              expenses: sumBy(txns, 'expense'),
            });
            current = addDays(monthEnd, 1);
          }
        }
      }

      setData(points);
    }
    load();
  }, [period, showComparison, customStart, customEnd]);

  // ── derived display values ────────────────────────────────────────────────────

  const selectedPoint = data.find((d) => d.label === selectedLabel) ?? null;
  const displayIncome = selectedPoint ? selectedPoint.income : data.reduce((s, d) => s + d.income, 0);
  const displayExpenses = selectedPoint ? selectedPoint.expenses : data.reduce((s, d) => s + d.expenses, 0);

  const summaryLabel = (() => {
    if (selectedPoint) return selectedPoint.displayDate;
    if (period === 'custom' && customStart && customEnd) {
      return `${format(parseISO(customStart), 'MMM d')} – ${format(parseISO(customEnd), 'MMM d, yyyy')}`;
    }
    return { daily: 'This week', weekly: '8-week total', monthly: '6-month total', quarterly: '6-quarter total', yearly: '4-year total', custom: 'Custom range' }[period];
  })();

  const maxBarSize = data.length <= 7 ? 32 : data.length <= 12 ? 22 : 16;

  function barFill(entry: ChartPoint, base: string, bright: string) {
    return selectedLabel && entry.label === selectedLabel ? bright : base;
  }
  function barOpacity(entry: ChartPoint) {
    if (selectedLabel && entry.label !== selectedLabel) return 0.22;
    if (entry.isFutureDay) return 0.45;
    return 1;
  }

  function handleChartClick(chartData: { activeLabel?: string }) {
    const label = chartData?.activeLabel;
    if (!label) return;
    setSelectedLabel((prev) => (prev === label ? null : label));
  }

  function applyCustomRange() {
    if (!customDraft.start || !customDraft.end) return;
    setCustomStart(customDraft.start);
    setCustomEnd(customDraft.end);
    setPeriod('custom');
    setMenuOpen(false);
  }

  function clearCustomRange() {
    setCustomStart('');
    setCustomEnd('');
    setCustomDraft({ start: '', end: '' });
    setPeriod('daily');
  }

  const basePeriods = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'] as const;

  return (
    <div>
      {/* ── Controls row ── */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period pills — hidden when custom range is active */}
          {period !== 'custom' && (
            <div className="flex gap-1 bg-slate-900/60 rounded-lg p-1">
              {basePeriods.map((key) => (
                <button
                  key={key}
                  onClick={() => setPeriod(key)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    period === key ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-200'
                  }`}
                  aria-pressed={period === key}
                  aria-label={key}
                >
                  {key[0].toUpperCase()}
                </button>
              ))}
            </div>
          )}

          {/* Custom range active badge */}
          {period === 'custom' && customStart && customEnd && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-sky-500/15 border border-sky-500/30 rounded-lg">
              <span className="text-xs font-medium text-sky-300">
                {format(parseISO(customStart), 'MMM d')} – {format(parseISO(customEnd), 'MMM d')}
              </span>
              <button
                onClick={clearCustomRange}
                className="text-sky-400 hover:text-white transition-colors leading-none ml-0.5"
                aria-label="Clear custom range"
              >
                ×
              </button>
            </div>
          )}
        </div>

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

          {/* Three-dot menu */}
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
              <div className="absolute right-0 top-full mt-2 w-56 bg-slate-800 border border-slate-700/80 rounded-xl shadow-2xl z-20 overflow-hidden">
                <div className="px-3 pt-2.5 pb-1">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Chart options</p>
                </div>

                {/* Compare toggle */}
                <button
                  onClick={() => { setShowComparison((v) => !v); setMenuOpen(false); }}
                  className="flex items-center justify-between w-full px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-700/40 transition-colors"
                >
                  <div>
                    <p className="font-medium">Compare past period</p>
                    <p className="text-xs text-slate-500 mt-0.5">Show prev. equivalent range</p>
                  </div>
                  <div className={`relative ml-3 w-9 h-5 rounded-full transition-colors shrink-0 ${showComparison ? 'bg-sky-500' : 'bg-slate-600'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showComparison ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                </button>

                <div className="border-t border-slate-700/60 mx-3 my-1" />

                {/* Custom date range */}
                <div className="px-3 pb-1">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Custom date range</p>
                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] text-slate-500 mb-0.5 block">From</label>
                      <input
                        type="date"
                        value={customDraft.start}
                        onChange={(e) => setCustomDraft((d) => ({ ...d, start: e.target.value }))}
                        className="w-full rounded-lg px-2 py-1.5 text-xs bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 mb-0.5 block">To</label>
                      <input
                        type="date"
                        value={customDraft.end}
                        min={customDraft.start}
                        onChange={(e) => setCustomDraft((d) => ({ ...d, end: e.target.value }))}
                        className="w-full rounded-lg px-2 py-1.5 text-xs bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <button
                      onClick={applyCustomRange}
                      disabled={!customDraft.start || !customDraft.end}
                      className="w-full py-1.5 rounded-lg text-xs font-semibold bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
                    >
                      Apply range
                    </button>
                  </div>
                </div>
                <div className="h-2" />
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

      {/* Bar chart */}
      <div aria-label={`${period} income vs expenses chart`} style={{ cursor: 'pointer' }}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={data}
            margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
            barCategoryGap="25%"
            barGap={2}
            onClick={handleChartClick}
          >
            <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
            <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${v}`} width={44} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b60', radius: 4 }} />

            {showComparison && (
              <>
                <Bar dataKey="pastIncome" radius={[3, 3, 0, 0]} maxBarSize={maxBarSize} name="pastIncome">
                  {data.map((e) => <Cell key={`pi-${e.label}`} fill="#a78bfa" fillOpacity={barOpacity(e) * 0.45} />)}
                </Bar>
                <Bar dataKey="pastExpenses" radius={[3, 3, 0, 0]} maxBarSize={maxBarSize} name="pastExpenses">
                  {data.map((e) => <Cell key={`pe-${e.label}`} fill="#fb923c" fillOpacity={barOpacity(e) * 0.45} />)}
                </Bar>
              </>
            )}

            <Bar dataKey="income" radius={[3, 3, 0, 0]} maxBarSize={maxBarSize} name="income">
              {data.map((e) => (
                <Cell key={`inc-${e.label}`} fill={barFill(e, '#10b981', '#34d399')} fillOpacity={barOpacity(e)} />
              ))}
            </Bar>

            <Bar dataKey="expenses" radius={[3, 3, 0, 0]} maxBarSize={maxBarSize} name="expenses">
              {data.map((e) => (
                <Cell key={`exp-${e.label}`} fill={barFill(e, '#ef4444', '#f87171')} fillOpacity={barOpacity(e)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {period === 'daily' && (
        <p className="text-[10px] text-slate-600 mt-1 text-center">
          Faded bars = future days · scheduled income shown
        </p>
      )}

      {/* ── Summary below chart ── */}
      <div className="mt-4 pt-4 border-t border-slate-700/50">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-wide">
            {summaryLabel}
          </p>
          {selectedLabel && (
            <button
              onClick={() => setSelectedLabel(null)}
              className="text-[10px] text-sky-400 hover:text-sky-300 transition-colors"
            >
              Show total ×
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">Income</p>
            <p className="text-2xl font-bold text-emerald-400 tabular-nums mt-1">
              £{displayIncome.toFixed(2)}
            </p>
            {selectedPoint?.isFutureDay && (
              <p className="text-[10px] text-sky-400 mt-0.5">Scheduled</p>
            )}
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">Expenses</p>
            <p className="text-2xl font-bold text-red-400 tabular-nums mt-1">
              £{displayExpenses.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── small legend dot ───────────────────────────────────────────────────────────

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: color }} />
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}
