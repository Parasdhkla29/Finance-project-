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
      <Input label="Person / Entity" placeholder="e.g. John Smith" required error={errors.counterparty?.message}
        {...register('counterparty', { required: 'Required' })} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Amount" type="number" step="0.01" min="0.01" required error={errors.amount?.message}
          {...register('amount', { required: 'Required' })} />
        <Input label="Currency" placeholder="GBP" {...register('currency')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Start Date" type="date" required {...register('startDate', { required: 'Required' })} />
        <Input label="Due Date" type="date" {...register('dueDate')} />
      </div>
      <Input label="Interest Rate (%/year)" type="number" step="0.01" placeholder="0" {...register('interestRate')} />
      <Textarea label="Notes" {...register('notes')} />
      <div className="flex gap-2 pt-2">
        <Button type="submit" loading={isSubmitting} className="flex-1">
          {initial ? 'Update' : 'Add Loan'}
        </Button>
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
        Remaining:{' '}
        <span className="text-slate-200 font-semibold">
          {formatCurrency(loan.remainingMinorUnits, loan.currency)}
        </span>
      </p>
      <Input label="Payment Amount" type="number" step="0.01" min="0.01" required
        {...register('amount', { required: true })} />
      <Input label="Date" type="date" required {...register('date', { required: true })} />
      <Textarea label="Notes" {...register('notes')} />
      <div className="flex gap-2 pt-2">
        <Button type="submit" loading={isSubmitting} className="flex-1" variant="success">
          Record Payment
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

// ── Inline edit form for a single payment ─────────────────────────────────────

interface EditPaymentFormData {
  amount: string;
  date: string;
  notes: string;
}

function EditPaymentRow({
  loan,
  paymentId,
  onDone,
}: {
  loan: Loan;
  paymentId: string;
  onDone: () => void;
}) {
  const { updatePayment } = useLoanStore();
  const payment = loan.payments.find((p) => p.id === paymentId);
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<EditPaymentFormData>({
    defaultValues: {
      amount: payment ? String(payment.amount / 100) : '',
      date: payment?.date ?? new Date().toISOString().split('T')[0],
      notes: payment?.notes ?? '',
    },
  });

  async function onSubmit(data: EditPaymentFormData) {
    await updatePayment(loan.id, paymentId, {
      amount: toMinor(parseFloat(data.amount)),
      date: data.date,
      notes: data.notes || undefined,
    });
    onDone();
  }

  return (
    <li className="px-2 py-2 rounded-lg bg-slate-700/30 border border-slate-600/40">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="Amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            {...register('amount', { required: true })}
          />
          <Input label="Date" type="date" required {...register('date', { required: true })} />
        </div>
        <Input label="Notes" placeholder="Optional note" {...register('notes')} />
        <div className="flex gap-2">
          <Button type="submit" size="sm" variant="success" loading={isSubmitting} className="flex-1">
            Save
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>
    </li>
  );
}

// ── Animated payment history dropdown ─────────────────────────────────────────

function PaymentHistoryDropdown({ loan }: { loan: Loan }) {
  const { removePayment } = useLoanStore();
  const [open, setOpen] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);

  return (
    <div className="mt-3 border-t border-slate-700/50 pt-3">
      {/* Toggle row */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors w-full text-left py-1 rounded-lg px-1 hover:bg-slate-700/30"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-3 w-3 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          />
        </svg>
        <span>
          {loan.payments.length} payment{loan.payments.length !== 1 ? 's' : ''} recorded
        </span>
      </button>

      {/* Payment rows (animated) */}
      {open && (
        <ul className="mt-2 space-y-1 animate-slideDown">
          {loan.payments.length === 0 ? (
            <li className="text-xs text-slate-600 italic px-2 py-1">No payments yet.</li>
          ) : (
            loan.payments.map((p) =>
              editingPaymentId === p.id ? (
                <EditPaymentRow
                  key={p.id}
                  loan={loan}
                  paymentId={p.id}
                  onDone={() => setEditingPaymentId(null)}
                />
              ) : (
              <li
                key={p.id}
                className="group flex items-center justify-between px-2 py-2 rounded-lg hover:bg-slate-700/40 transition-colors"
              >
                {/* Left: dot + info */}
                <div className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-400 font-mono">
                      +{formatCurrency(p.amount, loan.currency)}
                    </p>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      {format(new Date(p.date), 'd MMM yyyy')}
                      {p.notes && (
                        <> · <span className="italic text-slate-600">{p.notes}</span></>
                      )}
                    </p>
                  </div>
                </div>

                {/* Right: edit/delete icons (visible on hover) */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    title="Edit payment"
                    onClick={() => setEditingPaymentId(p.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-sky-400 hover:bg-sky-900/20 transition-colors"
                    aria-label="Edit payment"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                  <button
                    title="Delete payment"
                    onClick={() => removePayment(loan.id, p.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                    aria-label="Delete payment"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </li>
              )
            )
          )}
        </ul>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

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

  const lentTotal = loans
    .filter((l) => l.direction === 'lent' && l.status !== 'settled')
    .reduce((s, l) => s + l.remainingMinorUnits, 0);
  const borrowedTotal = loans
    .filter((l) => l.direction === 'borrowed' && l.status !== 'settled')
    .reduce((s, l) => s + l.remainingMinorUnits, 0);

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-4xl mx-auto pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Loans</h1>
        <Button size="sm" icon={<span>+</span>} onClick={() => { setEditing(undefined); setShowForm(true); }}>
          Add Loan
        </Button>
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

      {/* Filter chips */}
      <div className="flex gap-1 flex-wrap">
        {['active', 'partially_paid', 'overdue', 'settled', 'all'].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              filterStatus === s
                ? 'bg-sky-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
            }`}
          >
            {s === 'partially_paid' ? 'Partial' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Loan list */}
      {filtered.length === 0 ? (
        <Card>
          <p className="text-slate-500 text-sm text-center py-8">No loans here.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((loan) => {
            const pct = loan.principalMinorUnits > 0
              ? ((loan.principalMinorUnits - loan.remainingMinorUnits) / loan.principalMinorUnits) * 100
              : 0;
            const isOverdue =
              loan.dueDate &&
              new Date(loan.dueDate) < new Date() &&
              loan.status !== 'settled';

            // Progress bar colour
            const barColor =
              pct >= 100 ? 'bg-emerald-500' :
              isOverdue ? 'bg-red-500' :
              loan.status === 'partially_paid' ? 'bg-amber-500' :
              'bg-sky-500';

            return (
              <Card key={loan.id} className="relative overflow-hidden">
                {/* Side accent */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl ${
                    isOverdue ? 'bg-red-500' :
                    loan.status === 'partially_paid' ? 'bg-amber-500' :
                    loan.status === 'settled' ? 'bg-emerald-500' :
                    'bg-sky-500'
                  }`}
                />

                <div className="pl-3">
                  {/* Header */}
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
                      <p className="text-base font-bold text-slate-100">
                        {formatCurrency(loan.remainingMinorUnits, loan.currency)}
                      </p>
                      <p className="text-xs text-slate-500">
                        of {formatCurrency(loan.principalMinorUnits, loan.currency)}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div
                    className="w-full bg-slate-700 rounded-full h-1.5 mb-1"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className={`${barColor} h-1.5 rounded-full transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mb-3">{pct.toFixed(0)}% repaid</p>

                  {loan.notes && (
                    <p className="text-xs text-slate-400 mb-3 italic">{loan.notes}</p>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2 flex-wrap">
                    {loan.status !== 'settled' && (
                      <Button size="sm" variant="success" onClick={() => setPayingLoan(loan)}>
                        Record Payment
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => { setEditing(loan); setShowForm(true); }}
                    >
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(loan.id)}>
                      Delete
                    </Button>
                  </div>

                  {/* Animated payment history dropdown */}
                  <PaymentHistoryDropdown loan={loan} />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <Modal
        open={showForm}
        onClose={() => { setShowForm(false); setEditing(undefined); }}
        title={editing ? 'Edit Loan' : 'Add Loan'}
      >
        <LoanForm initial={editing} onDone={() => { setShowForm(false); setEditing(undefined); }} />
      </Modal>

      <Modal open={!!payingLoan} onClose={() => setPayingLoan(undefined)} title="Record Payment" size="sm">
        {payingLoan && (
          <PaymentForm loan={payingLoan} onDone={() => setPayingLoan(undefined)} />
        )}
      </Modal>
    </div>
  );
}
