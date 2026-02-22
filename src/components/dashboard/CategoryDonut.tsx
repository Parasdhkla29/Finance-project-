import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { db } from '../../core/db';
import { toMajor } from '../../core/types';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

interface Slice {
  name: string;
  value: number;
}

export default function CategoryDonut() {
  const [slices, setSlices] = useState<Slice[]>([]);

  useEffect(() => {
    async function load() {
      const now = new Date();
      const start = startOfMonth(now);
      const end = endOfMonth(now);

      const txns = await db.transactions
        .filter(
          (t) =>
            !t.deletedAt &&
            t.type === 'expense' &&
            isWithinInterval(new Date(t.date), { start, end }),
        )
        .toArray();

      const map: Record<string, number> = {};
      for (const t of txns) {
        map[t.category] = (map[t.category] ?? 0) + t.amountMinorUnits;
      }

      const sliceData = Object.entries(map)
        .map(([name, value]) => ({ name, value: toMajor(value) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);

      setSlices(sliceData);
    }
    load();
  }, []);

  if (slices.length === 0) {
    return <p className="text-slate-500 text-sm text-center py-8">No expenses this month</p>;
  }

  return (
    <div aria-label="Spending by category this month">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={slices}
            cx="50%"
            cy="45%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
          >
            {slices.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
            formatter={(value: number | undefined) => [`£${(value ?? 0).toFixed(2)}`] as [string]}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
