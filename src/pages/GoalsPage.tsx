import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { format, differenceInDays, parseISO } from 'date-fns';
import { useGoalStore } from '../store/useGoalStore';
import { useTransactionStore } from '../store/useTransactionStore';
import { useAccountStore } from '../store/useAccountStore';
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
      <Input label="Goal Name" placeholder="e.g. Send money to papa India" required {...register('name', { required: true })} />
      <Select label="Category" options={GOAL_CATEGORIES} {...register('category')} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Target Amount (£)" type="number" step="0.01" min="1" required {...register('targetAmount', { required: true })} />
        <Input label="Already saved (£)" type="number" step="0.01" min="0" {...register('currentAmount')} />
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

function GoalProjection({ goal }: { goal: FinancialGoal }) {
  const now = new Date();
  const remaining = goal.targetMinorUnits - goal.currentMinorUnits;
  const createdAt = parseISO(goal.createdAt);
  const daysSinceCreation = Math.max(1, differenceInDays(now, createdAt));
  const dailyRate = goal.currentMinorUnits / daysSinceCreation;

  if (goal.targetDate) {
    const targetDate = parseISO(goal.targetDate);
    const daysToTarget = differenceInDays(targetDate, now);
    if (daysToTarget <= 0) return <p className="text-xs text-red-600">Target date has passed</p>;
    const monthlyNeeded = (remaining / daysToTarget) * 30;
    const onTrack = dailyRate >= (remaining / daysToTarget) * 0.9;
    return (
      <div className="space-y-0.5">
        <p className={`text-xs ${onTrack ? 'text-emerald-600' : 'text-amber-600'}`}>
          {daysToTarget}d to target · Need {formatCurrency(monthlyNeeded, goal.currency)}/mo
        </p>
        {!onTrack && dailyRate > 0 && (
          <p className="text-xs text-slate-400">At current rate: {formatCurrency(dailyRate * 30, goal.currency)}/mo</p>
        )}
      </div>
    );
  }

  if (dailyRate > 0 && remaining > 0) {
    const projectedDate = new Date(now.getTime() + (remaining / dailyRate) * 86400000);
    return <p className="text-xs text-slate-400">At current pace: {format(projectedDate, 'MMM yyyy')}</p>;
  }
  return null;
}

// ── Goal card with linked transactions ────────────────────────────────────

function GoalCard({
  goal,
  onEdit,
  onRemove,
  onMarkAchieved,
}: {
  goal: FinancialGoal;
  onEdit: () => void;
  onRemove: () => void;
  onMarkAchieved: () => void;
}) {
  const [showTxns, setShowTxns] = useState(false);
  const { transactions } = useTransactionStore();
  const { accounts } = useAccountStore();

  const linkedTxns = transactions
    .filter((t) => t.linkedGoalId === goal.id && !t.deletedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const pct = goal.targetMinorUnits > 0
    ? Math.min(100, (goal.currentMinorUnits / goal.targetMinorUnits) * 100)
    : 0;
  const remaining = goal.targetMinorUnits - goal.currentMinorUnits;

  function getAccountName(accountId: string) {
    return accounts.find((a) => a.id === accountId)?.name ?? accountId;
  }

  return (
    <Card>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xl" aria-hidden="true">{CAT_EMOJI[goal.category] ?? '🎯'}</span>
            <p className="text-sm font-semibold text-slate-800">{goal.name}</p>
            {goal.isAchieved && <Badge variant="success">Achieved!</Badge>}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {GOAL_CATEGORIES.find((c) => c.value === goal.category)?.label}
            {goal.targetDate && ` · Target: ${format(new Date(goal.targetDate), 'd MMM yyyy')}`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-slate-900">{formatCurrency(goal.currentMinorUnits, goal.currency)}</p>
          <p className="text-xs text-slate-400">of {formatCurrency(goal.targetMinorUnits, goal.currency)}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-100 rounded-full h-2.5 mb-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`h-2.5 rounded-full transition-all ${goal.isAchieved ? 'bg-emerald-500' : 'bg-sky-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-slate-400">
          {pct.toFixed(0)}% complete
          {!goal.isAchieved && remaining > 0 && ` · ${formatCurrency(remaining, goal.currency)} to go`}
        </p>
        {!goal.isAchieved && <GoalProjection goal={goal} />}
      </div>

      {goal.notes && <p className="text-xs text-slate-500 mb-3 italic">{goal.notes}</p>}

      {/* Linked transactions toggle */}
      {linkedTxns.length > 0 && (
        <button
          onClick={() => setShowTxns((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 bg-sky-50 border border-sky-100 rounded-xl mb-3 text-xs font-semibold text-sky-700 hover:bg-sky-100 transition-colors"
        >
          <span>🔗 {linkedTxns.length} linked transaction{linkedTxns.length !== 1 ? 's' : ''}</span>
          <span>{showTxns ? '▲' : '▼'}</span>
        </button>
      )}

      {/* Linked transactions list */}
      {showTxns && linkedTxns.length > 0 && (
        <div className="mb-3 space-y-1.5 border border-sky-100 rounded-xl overflow-hidden">
          <div className="bg-sky-50 px-3 py-2 grid grid-cols-3 text-xs font-semibold text-sky-600 uppercase tracking-wide">
            <span>Date</span>
            <span className="text-center">Account</span>
            <span className="text-right">Amount</span>
          </div>
          {linkedTxns.map((t) => (
            <div key={t.id} className="px-3 py-2 border-t border-sky-50 bg-white">
              <div className="grid grid-cols-3 items-center gap-1">
                <div>
                  <p className="text-xs font-medium text-slate-800">
                    {format(parseISO(t.date), 'd MMM yyyy')}
                  </p>
                  <p className="text-xs text-slate-400">{format(parseISO(t.createdAt), 'h:mm a')}</p>
                </div>
                <p className="text-xs text-slate-500 text-center truncate">{getAccountName(t.accountId)}</p>
                <p className="text-sm font-bold text-sky-700 text-right">
                  −{formatCurrency(t.amountMinorUnits, t.currency)}
                </p>
              </div>
              {t.notes && <p className="text-xs text-slate-400 mt-0.5 italic">{t.notes}</p>}
              {t.category && <p className="text-xs text-slate-400">{t.category}</p>}
            </div>
          ))}
          {/* Total allocated row */}
          <div className="px-3 py-2 bg-sky-50 border-t border-sky-100 flex justify-between items-center">
            <span className="text-xs font-semibold text-sky-700">Total allocated via transactions</span>
            <span className="text-sm font-bold text-sky-700">
              {formatCurrency(linkedTxns.reduce((s, t) => s + t.amountMinorUnits, 0), goal.currency)}
            </span>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        {!goal.isAchieved && (
          <Button size="sm" variant="success" onClick={onMarkAchieved}>Mark achieved</Button>
        )}
        <Button size="sm" variant="secondary" onClick={onEdit}>Edit</Button>
        <Button size="sm" variant="ghost" onClick={onRemove}>Delete</Button>
      </div>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function GoalsPage() {
  const { goals, load, update, remove } = useGoalStore();
  const { load: loadTxns } = useTransactionStore();
  const { load: loadAccounts } = useAccountStore();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FinancialGoal | undefined>();

  useEffect(() => {
    load();
    loadTxns();
    loadAccounts();
  }, []);

  const active = goals.filter((g) => !g.isAchieved && !g.deletedAt);
  const achieved = goals.filter((g) => g.isAchieved && !g.deletedAt);

  function openAdd() {
    setEditing(undefined);
    setShowForm(true);
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Financial Goals</h1>
          <p className="text-slate-500 text-sm mt-0.5">Track your savings targets · link expenses to goals</p>
        </div>
        <Button size="sm" icon={<span>+</span>} onClick={openAdd}>Add Goal</Button>
      </div>

      {goals.filter((g) => !g.deletedAt).length === 0 ? (
        <Card>
          <div className="py-10 text-center space-y-3">
            <p className="text-slate-500 text-sm font-medium">No goals set yet</p>
            <p className="text-slate-400 text-xs max-w-xs mx-auto">
              Set a savings target — emergency fund, sending money, or anything you&apos;re working toward.
              Then link expenses to it from the Transactions tab.
            </p>
            <Button onClick={openAdd} icon={<span>+</span>}>Set your first goal</Button>
          </div>
        </Card>
      ) : (
        <>
          {active.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">In Progress</h2>
              {active.map((g) => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  onEdit={() => { setEditing(g); setShowForm(true); }}
                  onRemove={() => remove(g.id)}
                  onMarkAchieved={() => update(g.id, { isAchieved: true, currentMinorUnits: g.targetMinorUnits })}
                />
              ))}
            </div>
          )}
          {achieved.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Achieved</h2>
              {achieved.map((g) => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  onEdit={() => { setEditing(g); setShowForm(true); }}
                  onRemove={() => remove(g.id)}
                  onMarkAchieved={() => update(g.id, { isAchieved: true, currentMinorUnits: g.targetMinorUnits })}
                />
              ))}
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
