import { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { subMonths, startOfMonth, endOfMonth, format, isWithinInterval } from 'date-fns';
import { db } from '../../core/db';
import { toMajor } from '../../core/types';

interface DataPoint {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export default function NetBalanceChart() {
  const [data, setData] = useState<DataPoint[]>([]);

  useEffect(() => {
    async function load() {
      const now = new Date();
      const points: DataPoint[] = [];

      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(now, i);
        const start = startOfMonth(monthDate);
        const end = endOfMonth(monthDate);

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

        points.push({
          month: format(monthDate, 'MMM'),
          income: toMajor(income),
          expenses: toMajor(expenses),
          net: toMajor(income - expenses),
        });
      }
      setData(points);
    }
    load();
  }, []);

  return (
    <div aria-label="Net balance over last 6 months chart">
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${v}`} width={55} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
            labelStyle={{ color: '#e2e8f0' }}
            formatter={(value: number | undefined, name: string | undefined) => [`£${(value ?? 0).toFixed(2)}`, (name ?? '').charAt(0).toUpperCase() + (name ?? '').slice(1)] as [string, string]}
          />
          <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} fill="url(#incomeGrad)" name="income" />
          <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} fill="url(#expenseGrad)" name="expenses" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
