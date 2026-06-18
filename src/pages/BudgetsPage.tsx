import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, isWithinInterval, getDaysInMonth, getDate } from 'date-fns';
import { useBudgetStore } from '../store/useBudgetStore';
import { useTransactionStore } from '../store/useTransactionStore';
import type { Budget } from '../core/types';
import { formatCurrency, toMinor } from '../core/types';
import { useUIStore } from '../store/useUIStore';
import { ALL_CATEGORIES } from '../core/categorizer';
import BottomSheet from '../components/ui/BottomSheet';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';

interface BudgetFormData {
  name: string;
  category: string;
  amount: string;
  period: 'weekly' | 'monthly';
}

function BudgetForm({ initial, onDone }: { initial?: Budget; onDone: () => void }) {
  const { add, update } = useBudgetStore();
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<BudgetFormData>({
    defaultValues: {
      name: initial?.name ?? '',
      category: initial?.category ?? 'Groceries',
      amount: initial ? String(initial.amountMinorUnits / 100) : '',
      period: initial?.period ?? 'monthly',
    },
  });

  async function onSubmit(data: BudgetFormData) {
    const payload = {
      name: data.name,
      category: data.category,
      amountMinorUnits: toMinor(parseFloat(data.amount)),
      period: data.period,
      isActive: initial?.isActive ?? true,
    };
    if (initial) {
      await update(initial.id, payload);
    } else {
      await add(payload);
    }
    onDone();
  }

  const catOptions = ALL_CATEGORIES.map((c) => ({ value: c, label: c }));
  const periodOptions = [{ value: 'monthly', label: 'Monthly' }, { value: 'weekly', label: 'Weekly' }];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input label="Budget Name" placeholder="e.g. Grocery Budget" required {...register('name', { required: true })} />
      <Select label="Category" options={catOptions} {...register('category')} />
      <Select label="Period" options={periodOptions} {...register('period')} />
      <Input label="Amount Limit" type="number" step="0.01" min="1" required {...register('amount', { required: true })} />
      <div className="flex gap-2 pt-2">
        <Button type="submit" loading={isSubmitting} className="flex-1">{initial ? 'Update' : 'Create Budget'}</Button>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

export default function BudgetsPage() {
  const { budgets, load, remove } = useBudgetStore();
  const { transactions, load: loadTxns } = useTransactionStore();
  const { currency } = useUIStore();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Budget | undefined>();

  useEffect(() => { load(); loadTxns(); }, []);

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const daysInMonth = getDaysInMonth(now);
  const dayOfMonth = getDate(now);
  const daysLeft = daysInMonth - dayOfMonth;
  const monthElapsedPct = (dayOfMonth / daysInMonth) * 100;
  // Day of week: Monday=1 … Sunday=7
  const dayOfWeek = ((now.getDay() + 6) % 7) + 1;

  // Compute spent per category for both periods
  const monthSpent: Record<string, number> = {};
  const weekSpent: Record<string, number> = {};
  for (const t of transactions) {
    if (t.type === 'expense' && !t.deletedAt) {
      const txDate = new Date(t.date);
      if (isWithinInterval(txDate, { start: monthStart, end: monthEnd })) {
        monthSpent[t.category] = (monthSpent[t.category] ?? 0) + t.amountMinorUnits;
      }
      if (isWithinInterval(txDate, { start: weekStart, end: weekEnd })) {
        weekSpent[t.category] = (weekSpent[t.category] ?? 0) + t.amountMinorUnits;
      }
    }
  }

  const active = budgets.filter((b) => b.isActive && !b.deletedAt);

  function openAdd() {
    setEditing(undefined);
    setShowForm(true);
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Budgets</h1>
          <p className="text-slate-500 text-sm mt-0.5">Spending limits by category</p>
        </div>
        <Button size="sm" icon={<span>+</span>} onClick={openAdd}>Add Budget</Button>
      </div>

      {/* Month progress context */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white border border-slate-200 rounded-xl">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500">Month elapsed</span>
            <span className="text-xs text-slate-500">{dayOfMonth}/{daysInMonth} days · {daysLeft} left</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5">
            <div className="h-1.5 rounded-full bg-slate-500 transition-all" style={{ width: `${monthElapsedPct}%` }} />
          </div>
        </div>
      </div>

      {active.length === 0 ? (
        <Card>
          <div className="py-10 text-center space-y-3">
            <p className="text-slate-500 text-sm font-medium">No budgets set yet</p>
            <p className="text-slate-400 text-xs max-w-xs mx-auto">Create spending limits by category to stay on track each month.</p>
            <Button onClick={openAdd} icon={<span>+</span>}>Create your first budget</Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {active.map((budget) => {
            const isWeekly = budget.period === 'weekly';
            const spent = isWeekly
              ? (weekSpent[budget.category] ?? 0)
              : (monthSpent[budget.category] ?? 0);
            const pct = budget.amountMinorUnits > 0 ? (spent / budget.amountMinorUnits) * 100 : 0;
            const remaining = budget.amountMinorUnits - spent;
            const isOver = pct >= 100;
            const isWarning = pct >= 80;

            // Period-specific time vars
            const daysInPeriod = isWeekly ? 7 : daysInMonth;
            const dayOfPeriod = isWeekly ? dayOfWeek : dayOfMonth;
            const daysLeftInPeriod = isWeekly ? (7 - dayOfWeek) : daysLeft;

            // Pace: are you spending faster or slower than the period's progress?
            const expectedSpent = budget.amountMinorUnits * (dayOfPeriod / daysInPeriod);
            const paceStatus =
              isOver ? 'over'
              : spent > expectedSpent * 1.1 ? 'fast'
              : spent < expectedSpent * 0.5 ? 'slow'
              : 'on-pace';

            // Projected end-of-period spend
            const dailyRate = dayOfPeriod > 0 ? spent / dayOfPeriod : 0;
            const projectedTotal = dailyRate * daysInPeriod;
            const projectedOver = projectedTotal > budget.amountMinorUnits;

            return (
              <Card key={budget.id}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-800">{budget.name}</p>
                      <Badge variant="info">{budget.period}</Badge>
                      {isOver && <Badge variant="danger">Over budget</Badge>}
                      {isWarning && !isOver && <Badge variant="warning">80% used</Badge>}
                      {!isOver && paceStatus === 'fast' && (
                        <Badge variant="warning">Spending fast</Badge>
                      )}
                      {!isOver && paceStatus === 'on-pace' && (
                        <Badge variant="success">On pace</Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{budget.category}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-900">
                      {formatCurrency(spent, currency)} / {formatCurrency(budget.amountMinorUnits, currency)}
                    </p>
                    <p className={`text-xs mt-0.5 ${isOver ? 'text-red-600' : 'text-slate-400'}`}>
                      {isOver ? `${formatCurrency(Math.abs(remaining), currency)} over` : `${formatCurrency(remaining, currency)} left`}
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 rounded-full h-2 mb-1" role="progressbar" aria-valuenow={Math.min(pct, 100)} aria-valuemin={0} aria-valuemax={100}>
                  <div
                    className={`h-2 rounded-full transition-all ${isOver ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>

                {/* Temporal context row */}
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-slate-400">{pct.toFixed(0)}% used · {daysLeftInPeriod}d left</p>
                  {!isOver && dailyRate > 0 && (
                    <p className={`text-xs ${projectedOver ? 'text-amber-600' : 'text-slate-400'}`}>
                      Projected: {formatCurrency(projectedTotal, currency)}{projectedOver ? ' ⚠ over limit' : ''}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => { setEditing(budget); setShowForm(true); }}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(budget.id)}>Delete</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <BottomSheet open={showForm} onClose={() => { setShowForm(false); setEditing(undefined); }} title={editing ? 'Edit Budget' : 'Create Budget'}>
        <div className="px-5 py-4">
          <BudgetForm initial={editing} onDone={() => { setShowForm(false); setEditing(undefined); }} />
        </div>
      </BottomSheet>
    </div>
  );
}
