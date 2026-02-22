import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { useGoalStore } from '../store/useGoalStore';
import type { FinancialGoal } from '../core/types';
import { formatCurrency, toMinor } from '../core/types';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';

const GOAL_CATEGORIES: Array<{ value: FinancialGoal['category']; label: string }> = [
  { value: 'emergency_fund', label: 'Emergency Fund' },
  { value: 'investment', label: 'Investment' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'debt_payoff', label: 'Debt Payoff' },
  { value: 'custom', label: 'Custom' },
];

interface GoalFormData {
  name: string;
  targetAmount: string;
  currentAmount: string;
  currency: string;
  targetDate: string;
  category: string;
  notes: string;
}

function GoalForm({ initial, onDone }: { initial?: FinancialGoal; onDone: () => void }) {
  const { add, update } = useGoalStore();
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<GoalFormData>({
    defaultValues: {
      name: initial?.name ?? '',
      targetAmount: initial ? String(initial.targetMinorUnits / 100) : '',
      currentAmount: initial ? String(initial.currentMinorUnits / 100) : '0',
      currency: initial?.currency ?? 'GBP',
      targetDate: initial?.targetDate ?? '',
      category: initial?.category ?? 'custom',
      notes: initial?.notes ?? '',
    },
  });

  async function onSubmit(data: GoalFormData) {
    const target = toMinor(parseFloat(data.targetAmount));
    const current = toMinor(parseFloat(data.currentAmount || '0'));
    const payload = {
      name: data.name,
      targetMinorUnits: target,
      currentMinorUnits: current,
      currency: data.currency || 'GBP',
      targetDate: data.targetDate || undefined,
      category: data.category as FinancialGoal['category'],
      notes: data.notes || undefined,
      isAchieved: current >= target,
    };
    if (initial) {
      await update(initial.id, payload);
    } else {
      await add(payload);
    }
    onDone();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input label="Goal Name" placeholder="e.g. Emergency Fund" required {...register('name', { required: true })} />
      <Select label="Category" options={GOAL_CATEGORIES} {...register('category')} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Target Amount" type="number" step="0.01" min="1" required {...register('targetAmount', { required: true })} />
        <Input label="Current Amount" type="number" step="0.01" min="0" {...register('currentAmount')} />
      </div>
      <Input label="Target Date (optional)" type="date" {...register('targetDate')} />
      <Textarea label="Notes" {...register('notes')} />
      <div className="flex gap-2 pt-2">
        <Button type="submit" loading={isSubmitting} className="flex-1">{initial ? 'Update' : 'Create Goal'}</Button>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

const CAT_EMOJI: Record<string, string> = {
  emergency_fund: '🛡',
  investment: '📈',
  purchase: '🛒',
  debt_payoff: '💳',
  custom: '🎯',
};

export default function GoalsPage() {
  const { goals, load, update, remove } = useGoalStore();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FinancialGoal | undefined>();

  useEffect(() => { load(); }, []);

  const active = goals.filter((g) => !g.isAchieved && !g.deletedAt);
  const achieved = goals.filter((g) => g.isAchieved && !g.deletedAt);

  function GoalCard({ goal }: { goal: FinancialGoal }) {
    const pct = goal.targetMinorUnits > 0
      ? (goal.currentMinorUnits / goal.targetMinorUnits) * 100
      : 0;
    const remaining = goal.targetMinorUnits - goal.currentMinorUnits;

    return (
      <Card>
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl" aria-hidden="true">{CAT_EMOJI[goal.category] ?? '🎯'}</span>
              <p className="text-sm font-semibold text-slate-200">{goal.name}</p>
              {goal.isAchieved && <Badge variant="success">Achieved!</Badge>}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {GOAL_CATEGORIES.find((c) => c.value === goal.category)?.label}
              {goal.targetDate && ` · Target: ${format(new Date(goal.targetDate), 'd MMM yyyy')}`}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-slate-100">
              {formatCurrency(goal.currentMinorUnits, goal.currency)}
            </p>
            <p className="text-xs text-slate-500">of {formatCurrency(goal.targetMinorUnits, goal.currency)}</p>
          </div>
        </div>

        <div className="w-full bg-slate-700 rounded-full h-2 mb-2" role="progressbar" aria-valuenow={Math.min(pct, 100)} aria-valuemin={0} aria-valuemax={100}>
          <div
            className={`h-2 rounded-full transition-all ${goal.isAchieved ? 'bg-emerald-500' : 'bg-sky-500'}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <p className="text-xs text-slate-500 mb-3">
          {pct.toFixed(0)}% complete
          {!goal.isAchieved && remaining > 0 && ` · ${formatCurrency(remaining, goal.currency)} to go`}
        </p>

        {goal.notes && <p className="text-xs text-slate-400 mb-3 italic">{goal.notes}</p>}

        <div className="flex gap-2">
          {!goal.isAchieved && (
            <Button
              size="sm"
              variant="success"
              onClick={() => update(goal.id, { isAchieved: true, currentMinorUnits: goal.targetMinorUnits })}
            >
              Mark achieved
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => { setEditing(goal); setShowForm(true); }}>Edit</Button>
          <Button size="sm" variant="ghost" onClick={() => remove(goal.id)}>Delete</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Financial Goals</h1>
          <p className="text-slate-400 text-sm mt-0.5">Track your savings targets and milestones</p>
        </div>
        <Button size="sm" icon={<span>+</span>} onClick={() => { setEditing(undefined); setShowForm(true); }}>Add Goal</Button>
      </div>

      {goals.filter((g) => !g.deletedAt).length === 0 ? (
        <Card>
          <p className="text-slate-500 text-sm text-center py-8">
            No goals yet. Set a savings target to get started!
          </p>
        </Card>
      ) : (
        <>
          {active.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">In Progress</h2>
              {active.map((g) => <GoalCard key={g.id} goal={g} />)}
            </div>
          )}
          {achieved.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Achieved</h2>
              {achieved.map((g) => <GoalCard key={g.id} goal={g} />)}
            </div>
          )}
        </>
      )}

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditing(undefined); }} title={editing ? 'Edit Goal' : 'New Goal'}>
        <GoalForm initial={editing} onDone={() => { setShowForm(false); setEditing(undefined); }} />
      </Modal>
    </div>
  );
}
