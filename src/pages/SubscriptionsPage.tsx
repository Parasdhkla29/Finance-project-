import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { format, addDays, isWithinInterval } from 'date-fns';
import { useSubscriptionStore } from '../store/useSubscriptionStore';
import type { Subscription } from '../core/types';
import { formatCurrency, toMinor } from '../core/types';
import { ALL_CATEGORIES } from '../core/categorizer';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';

const CYCLE_MULTIPLIER: Record<Subscription['billingCycle'], number> = {
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  annual: 1,
};

function annualCost(sub: Subscription): number {
  return sub.amountMinorUnits * CYCLE_MULTIPLIER[sub.billingCycle];
}

function monthlyCost(sub: Subscription): number {
  return annualCost(sub) / 12;
}

const CYCLE_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
];

interface SubFormData {
  name: string;
  amount: string;
  currency: string;
  billingCycle: Subscription['billingCycle'];
  nextBillingDate: string;
  category: string;
  url: string;
  notes: string;
}

function SubForm({ initial, onDone }: { initial?: Subscription; onDone: () => void }) {
  const { add, update } = useSubscriptionStore();
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<SubFormData>({
    defaultValues: {
      name: initial?.name ?? '',
      amount: initial ? String(initial.amountMinorUnits / 100) : '',
      currency: initial?.currency ?? 'GBP',
      billingCycle: initial?.billingCycle ?? 'monthly',
      nextBillingDate: initial?.nextBillingDate ?? new Date().toISOString().split('T')[0],
      category: initial?.category ?? 'Entertainment',
      url: initial?.url ?? '',
      notes: initial?.notes ?? '',
    },
  });

  async function onSubmit(data: SubFormData) {
    const payload = {
      name: data.name,
      amountMinorUnits: toMinor(parseFloat(data.amount)),
      currency: data.currency || 'GBP',
      billingCycle: data.billingCycle,
      nextBillingDate: data.nextBillingDate,
      category: data.category || 'Entertainment',
      url: data.url || undefined,
      isActive: initial?.isActive ?? true,
      notes: data.notes || undefined,
    };
    if (initial) {
      await update(initial.id, payload);
    } else {
      await add(payload);
    }
    onDone();
  }

  const catOptions = ALL_CATEGORIES.map((c) => ({ value: c, label: c }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input label="Subscription Name" placeholder="e.g. Netflix" required {...register('name', { required: true })} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Amount" type="number" step="0.01" min="0.01" required {...register('amount', { required: true })} />
        <Select label="Billing Cycle" options={CYCLE_OPTIONS} {...register('billingCycle')} />
      </div>
      <Input label="Next Billing Date" type="date" required {...register('nextBillingDate', { required: true })} />
      <Select label="Category" options={catOptions} {...register('category')} />
      <Input label="Website URL" type="url" placeholder="https://..." {...register('url')} />
      <Textarea label="Notes" {...register('notes')} />
      <div className="flex gap-2 pt-2">
        <Button type="submit" loading={isSubmitting} className="flex-1">{initial ? 'Update' : 'Add Subscription'}</Button>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

export default function SubscriptionsPage() {
  const { subscriptions, load, update, remove } = useSubscriptionStore();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Subscription | undefined>();
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => { load(); }, []);

  const now = new Date();
  const next7 = addDays(now, 7);

  const active = subscriptions.filter((s) => !s.deletedAt && (showInactive ? true : s.isActive));
  const totalMonthly = subscriptions
    .filter((s) => s.isActive && !s.deletedAt)
    .reduce((sum, s) => sum + monthlyCost(s), 0);
  const totalAnnual = subscriptions
    .filter((s) => s.isActive && !s.deletedAt)
    .reduce((sum, s) => sum + annualCost(s), 0);

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Subscriptions</h1>
        <Button size="sm" icon={<span>+</span>} onClick={() => { setEditing(undefined); setShowForm(true); }}>Add</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Monthly cost</p>
          <p className="text-lg font-bold text-amber-400 mt-1">{formatCurrency(Math.round(totalMonthly), 'GBP')}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Annual cost</p>
          <p className="text-lg font-bold text-amber-400 mt-1">{formatCurrency(Math.round(totalAnnual), 'GBP')}</p>
          <p className="text-xs text-slate-500 mt-0.5">{subscriptions.filter((s) => s.isActive && !s.deletedAt).length} active subscriptions</p>
        </Card>
      </div>

      {/* Toggle inactive */}
      <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-400">
        <input
          type="checkbox"
          checked={showInactive}
          onChange={(e) => setShowInactive(e.target.checked)}
          className="rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-sky-500"
        />
        Show inactive
      </label>

      {/* List */}
      {active.length === 0 ? (
        <Card><p className="text-slate-500 text-sm text-center py-8">No subscriptions yet. Add your recurring bills!</p></Card>
      ) : (
        <div className="space-y-3">
          {active.map((sub) => {
            const dueThisWeek = isWithinInterval(new Date(sub.nextBillingDate), { start: now, end: next7 });
            const isOverdue = new Date(sub.nextBillingDate) < now;

            return (
              <Card key={sub.id} className={!sub.isActive ? 'opacity-60' : ''}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-200">{sub.name}</p>
                      {dueThisWeek && !isOverdue && <Badge variant="warning">Due soon</Badge>}
                      {isOverdue && sub.isActive && <Badge variant="danger">Overdue</Badge>}
                      {!sub.isActive && <Badge>Inactive</Badge>}
                      <Badge variant="info">{sub.billingCycle}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {sub.category} · Next: {format(new Date(sub.nextBillingDate), 'd MMM yyyy')}
                    </p>
                    {sub.url && (
                      <a
                        href={sub.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-sky-400 hover:underline"
                      >
                        {sub.url}
                      </a>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-100">{formatCurrency(sub.amountMinorUnits, sub.currency)}</p>
                    <p className="text-xs text-slate-500">≈ £{(monthlyCost(sub) / 100).toFixed(2)}/mo</p>
                  </div>
                </div>

                {sub.notes && <p className="text-xs text-slate-400 mt-2 italic">{sub.notes}</p>}

                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant={sub.isActive ? 'ghost' : 'secondary'}
                    onClick={() => update(sub.id, { isActive: !sub.isActive })}
                  >
                    {sub.isActive ? 'Pause' : 'Activate'}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => { setEditing(sub); setShowForm(true); }}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(sub.id)}>Delete</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditing(undefined); }} title={editing ? 'Edit Subscription' : 'Add Subscription'}>
        <SubForm initial={editing} onDone={() => { setShowForm(false); setEditing(undefined); }} />
      </Modal>
    </div>
  );
}
