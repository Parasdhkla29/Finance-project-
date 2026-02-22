import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { useLoanStore } from '../store/useLoanStore';
import type { Loan } from '../core/types';
import { formatCurrency, toMinor } from '../core/types';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';

const STATUS_LABELS: Record<Loan['status'], string> = {
  active: 'Active',
  partially_paid: 'Partial',
  settled: 'Settled',
  overdue: 'Overdue',
};

const STATUS_BADGE: Record<Loan['status'], 'success' | 'warning' | 'info' | 'danger'> = {
  active: 'info',
  partially_paid: 'warning',
  settled: 'success',
  overdue: 'danger',
};

interface LoanFormData {
  direction: 'lent' | 'borrowed';
  counterparty: string;
  amount: string;
  currency: string;
  interestRate: string;
  startDate: string;
  dueDate: string;
  notes: string;
}

interface PaymentFormData {
  amount: string;
  date: string;
  notes: string;
}

function LoanForm({ initial, onDone }: { initial?: Loan; onDone: () => void }) {
  const { add, update } = useLoanStore();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoanFormData>({
    defaultValues: {
      direction: initial?.direction ?? 'lent',
      counterparty: initial?.counterparty ?? '',
      amount: initial ? String(initial.principalMinorUnits / 100) : '',
      currency: initial?.currency ?? 'GBP',
      interestRate: initial?.interestRate ? String(initial.interestRate) : '',
      startDate: initial?.startDate ?? new Date().toISOString().split('T')[0],
      dueDate: initial?.dueDate ?? '',
      notes: initial?.notes ?? '',
    },
  });

  async function onSubmit(data: LoanFormData) {
    const principal = toMinor(parseFloat(data.amount));
    const payload = {
      direction: data.direction,
      counterparty: data.counterparty,
      principalMinorUnits: principal,
      currency: data.currency || 'GBP',
      remainingMinorUnits: initial?.remainingMinorUnits ?? principal,
      interestRate: data.interestRate ? parseFloat(data.interestRate) : undefined,
      startDate: data.startDate,
      dueDate: data.dueDate || undefined,
      status: (initial?.status ?? 'active') as Loan['status'],
      notes: data.notes || undefined,
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
      <Select
        label="Direction"
        options={[{ value: 'lent', label: 'I lent money' }, { value: 'borrowed', label: 'I borrowed money' }]}
        {...register('direction')}
      />
      <Input label="Person / Entity" placeholder="e.g. John Smith" required error={errors.counterparty?.message} {...register('counterparty', { required: 'Required' })} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Amount" type="number" step="0.01" min="0.01" required error={errors.amount?.message} {...register('amount', { required: 'Required' })} />
        <Input label="Currency" placeholder="GBP" {...register('currency')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Start Date" type="date" required {...register('startDate', { required: 'Required' })} />
        <Input label="Due Date" type="date" {...register('dueDate')} />
      </div>
      <Input label="Interest Rate (%/year)" type="number" step="0.01" placeholder="0" {...register('interestRate')} />
      <Textarea label="Notes" {...register('notes')} />
      <div className="flex gap-2 pt-2">
        <Button type="submit" loading={isSubmitting} className="flex-1">{initial ? 'Update' : 'Add Loan'}</Button>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

function PaymentForm({ loan, onDone }: { loan: Loan; onDone: () => void }) {
  const { addPayment } = useLoanStore();
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<PaymentFormData>({
    defaultValues: { amount: '', date: new Date().toISOString().split('T')[0], notes: '' },
  });

  async function onSubmit(data: PaymentFormData) {
    await addPayment(loan.id, {
      amount: toMinor(parseFloat(data.amount)),
      date: data.date,
      notes: data.notes || undefined,
    });
    onDone();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <p className="text-sm text-slate-400">
        Remaining: <span className="text-slate-200 font-semibold">{formatCurrency(loan.remainingMinorUnits, loan.currency)}</span>
      </p>
      <Input label="Payment Amount" type="number" step="0.01" min="0.01" required {...register('amount', { required: true })} />
      <Input label="Date" type="date" required {...register('date', { required: true })} />
      <Textarea label="Notes" {...register('notes')} />
      <div className="flex gap-2 pt-2">
        <Button type="submit" loading={isSubmitting} className="flex-1" variant="success">Record Payment</Button>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

export default function LoansPage() {
  const { loans, load, remove } = useLoanStore();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Loan | undefined>();
  const [payingLoan, setPayingLoan] = useState<Loan | undefined>();
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => { load(); }, []);

  const filtered = loans.filter((l) =>
    filterStatus === 'all' ? true : l.status === filterStatus,
  );

  const lentTotal = loans.filter((l) => l.direction === 'lent' && l.status !== 'settled').reduce((s, l) => s + l.remainingMinorUnits, 0);
  const borrowedTotal = loans.filter((l) => l.direction === 'borrowed' && l.status !== 'settled').reduce((s, l) => s + l.remainingMinorUnits, 0);

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Loans</h1>
        <Button size="sm" icon={<span>+</span>} onClick={() => { setEditing(undefined); setShowForm(true); }}>Add Loan</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Owed to you</p>
          <p className="text-lg font-bold text-emerald-400 mt-1">{formatCurrency(lentTotal, 'GBP')}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500 uppercase tracking-wide">You owe</p>
          <p className="text-lg font-bold text-red-400 mt-1">{formatCurrency(borrowedTotal, 'GBP')}</p>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-1">
        {['active', 'partially_paid', 'overdue', 'settled', 'all'].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${filterStatus === s ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'}`}
          >
            {s === 'partially_paid' ? 'Partial' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card><p className="text-slate-500 text-sm text-center py-8">No loans here.</p></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((loan) => {
            const pct = loan.principalMinorUnits > 0
              ? ((loan.principalMinorUnits - loan.remainingMinorUnits) / loan.principalMinorUnits) * 100
              : 0;
            const isOverdue = loan.dueDate && new Date(loan.dueDate) < new Date() && loan.status !== 'settled';

            return (
              <Card key={loan.id}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-200">{loan.counterparty}</p>
                      <Badge variant={isOverdue ? 'danger' : STATUS_BADGE[loan.status]}>
                        {isOverdue ? 'Overdue' : STATUS_LABELS[loan.status]}
                      </Badge>
                      <Badge variant={loan.direction === 'lent' ? 'success' : 'warning'}>
                        {loan.direction === 'lent' ? 'Lent' : 'Borrowed'}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Started {format(new Date(loan.startDate), 'd MMM yyyy')}
                      {loan.dueDate && ` · Due ${format(new Date(loan.dueDate), 'd MMM yyyy')}`}
                      {loan.interestRate && ` · ${loan.interestRate}% p.a.`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold text-slate-100">{formatCurrency(loan.remainingMinorUnits, loan.currency)}</p>
                    <p className="text-xs text-slate-500">of {formatCurrency(loan.principalMinorUnits, loan.currency)}</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-700 rounded-full h-1.5 mb-3" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                  <div
                    className="bg-sky-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mb-3">{pct.toFixed(0)}% repaid</p>

                {loan.notes && <p className="text-xs text-slate-400 mb-3 italic">{loan.notes}</p>}

                <div className="flex gap-2">
                  {loan.status !== 'settled' && (
                    <Button size="sm" variant="success" onClick={() => setPayingLoan(loan)}>Record Payment</Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => { setEditing(loan); setShowForm(true); }}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(loan.id)}>Delete</Button>
                </div>

                {/* Payment history */}
                {loan.payments.length > 0 && (
                  <details className="mt-3">
                    <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300">
                      {loan.payments.length} payment{loan.payments.length !== 1 ? 's' : ''} recorded
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {loan.payments.map((p) => (
                        <li key={p.id} className="flex justify-between text-xs text-slate-400">
                          <span>{format(new Date(p.date), 'd MMM yyyy')}{p.notes ? ` — ${p.notes}` : ''}</span>
                          <span className="text-emerald-400">{formatCurrency(p.amount, loan.currency)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditing(undefined); }} title={editing ? 'Edit Loan' : 'Add Loan'}>
        <LoanForm initial={editing} onDone={() => { setShowForm(false); setEditing(undefined); }} />
      </Modal>

      <Modal open={!!payingLoan} onClose={() => setPayingLoan(undefined)} title="Record Payment" size="sm">
        {payingLoan && <PaymentForm loan={payingLoan} onDone={() => setPayingLoan(undefined)} />}
      </Modal>
    </div>
  );
}
