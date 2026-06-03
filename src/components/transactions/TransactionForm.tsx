import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useAccountStore } from '../../store/useAccountStore';
import { useTransactionStore } from '../../store/useTransactionStore';
import { useUIStore } from '../../store/useUIStore';
import { ALL_CATEGORIES } from '../../core/categorizer';
import { toMinor } from '../../core/types';
import type { Transaction, PaymentTiming } from '../../core/types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Textarea from '../ui/Textarea';

interface FormData {
  type: 'income' | 'expense' | 'transfer';
  amount: string;
  date: string;
  expectedDate: string;
  paymentTiming: PaymentTiming;
  category: string;
  notes: string;
  accountId: string;
  paymentMethod: string;
  tags: string;
}

interface TransactionFormProps {
  initial?: Transaction;
  onDone: () => void;
}

const TYPE_OPTIONS = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
];

const PAYMENT_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'card', label: 'Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'direct_debit', label: 'Direct Debit' },
  { value: 'other', label: 'Other' },
];

// Tomorrow's date as ISO string for the min attribute on future date picker
function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

// ── main form ────────────────────────────────────────────────────────────────

export default function TransactionForm({ initial, onDone }: TransactionFormProps) {
  const { accounts } = useAccountStore();
  const { add, update } = useTransactionStore();
  const { defaultAccountId } = useUIStore();

  const isFutureInitial = initial?.paymentTiming === 'future';

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      type: initial?.type ?? 'expense',
      amount: initial ? String(initial.amountMinorUnits / 100) : '',
      date: (!isFutureInitial ? initial?.date : undefined) ?? new Date().toISOString().split('T')[0],
      expectedDate: isFutureInitial ? initial?.date : tomorrow(),
      paymentTiming: initial?.paymentTiming ?? 'instant',
      category: initial?.category ?? '',
      notes: initial?.notes ?? '',
      accountId: initial?.accountId ?? defaultAccountId ?? accounts[0]?.id ?? '',
      paymentMethod: initial?.paymentMethod ?? '',
      tags: initial?.tags.join(', ') ?? '',
    },
  });

  const type = watch('type');
  const paymentTiming = watch('paymentTiming');
  const paymentMethod = watch('paymentMethod');
  const isFuture = type === 'income' && paymentTiming === 'future';
  const isCash = paymentMethod === 'cash';

  // Reset timing to 'instant' when switching away from income
  useEffect(() => {
    if (type !== 'income') {
      setValue('paymentTiming', 'instant');
    }
  }, [type, setValue]);

  async function onSubmit(data: FormData) {
    const resolvedDate = isFuture ? data.expectedDate : data.date;
    const resolvedAccountId = isCash ? (defaultAccountId ?? accounts[0]?.id ?? '') : data.accountId;

    const payload = {
      accountId: resolvedAccountId,
      type: data.type as Transaction['type'],
      amountMinorUnits: toMinor(parseFloat(data.amount)),
      currency: accounts.find((a) => a.id === resolvedAccountId)?.currency ?? 'GBP',
      category: data.category || 'Uncategorized',
      notes: data.notes,
      date: resolvedDate,
      paymentMethod: (data.paymentMethod as Transaction['paymentMethod']) || undefined,
      paymentTiming: data.type === 'income' ? data.paymentTiming : undefined,
      tags: data.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      isRecurring: false,
    };

    if (initial) {
      await update(initial.id, payload);
    } else {
      await add(payload);
    }
    onDone();
  }

  const activeAccounts = accounts.filter((a) => !a.isArchived && !a.deletedAt);
  const accountOptions = activeAccounts.map((a) => ({ value: a.id, label: a.name }));

  const categoryOptions = ['', ...ALL_CATEGORIES].map((c) => ({
    value: c,
    label: c || 'Select category',
  }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Type + Account */}
      <div className={!isCash && activeAccounts.length > 1 ? 'grid grid-cols-2 gap-3' : ''}>
        <Select
          label="Type"
          options={TYPE_OPTIONS}
          {...register('type', { required: true })}
        />
        {!isCash && activeAccounts.length > 1 && (
          <Select
            label="Account"
            options={accountOptions}
            {...register('accountId')}
          />
        )}
      </div>

      {/* Single account chip — hidden for cash */}
      {!isCash && activeAccounts.length === 1 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: activeAccounts[0].color }}
            aria-hidden="true"
          />
          <span className="text-xs text-slate-500">Account:</span>
          <span className="text-xs font-medium text-slate-800">{activeAccounts[0].name}</span>
          <span className="ml-auto text-xs text-slate-400 uppercase tracking-wide">{activeAccounts[0].currency}</span>
        </div>
      )}

      {/* ── Payment timing (income only) ── */}
      {type === 'income' && (
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">When will you receive it?</p>
          <div className="grid grid-cols-2 gap-2">
            {/* Instant */}
            <button
              type="button"
              onClick={() => setValue('paymentTiming', 'instant')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${
                paymentTiming === 'instant'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-300'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
              aria-pressed={paymentTiming === 'instant'}
            >
              <span className={`text-base leading-none ${paymentTiming === 'instant' ? 'text-emerald-600' : 'text-slate-400'}`}>
                ✓
              </span>
              <div>
                <p className="text-xs font-semibold leading-none">Instant</p>
                <p className="text-xs mt-0.5 opacity-70">Received today</p>
              </div>
            </button>

            {/* Future payment */}
            <button
              type="button"
              onClick={() => setValue('paymentTiming', 'future')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${
                paymentTiming === 'future'
                  ? 'bg-sky-50 border-sky-300 text-sky-300'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
              aria-pressed={paymentTiming === 'future'}
            >
              <span className={`text-base leading-none ${paymentTiming === 'future' ? 'text-sky-600' : 'text-slate-400'}`}>
                ⏳
              </span>
              <div>
                <p className="text-xs font-semibold leading-none">Future payment</p>
                <p className="text-xs mt-0.5 opacity-70">Expected later</p>
              </div>
            </button>
          </div>

          {/* Expected date — only shown when future is selected */}
          {isFuture && (
            <div className="mt-3 p-3 bg-sky-50 border border-sky-200 rounded-xl">
              <Input
                label="Expected date"
                type="date"
                min={tomorrow()}
                required
                error={errors.expectedDate?.message}
                {...register('expectedDate', {
                  required: 'Expected date is required',
                  validate: (v) => v >= tomorrow() || 'Must be a future date',
                })}
              />
              <p className="text-xs text-sky-600/70 mt-1.5">
                This income will appear as "Scheduled" until the expected date.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Amount + Date row */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Amount"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0.00"
          required
          error={errors.amount?.message}
          {...register('amount', {
            required: 'Amount is required',
            min: { value: 0.01, message: 'Must be > 0' },
          })}
        />
        {/* Hide date when future is selected (expectedDate used instead) */}
        {!isFuture && (
          <Input
            label="Date"
            type="date"
            required
            error={errors.date?.message}
            {...register('date', { required: 'Date is required' })}
          />
        )}
        {isFuture && (
          /* spacer so amount doesn't stretch full width awkwardly */
          <div />
        )}
      </div>

      <Textarea
        label="Notes"
        placeholder="Describe this transaction..."
        required
        error={errors.notes?.message}
        {...register('notes', { required: 'Notes is required' })}
      />

      <Select
        label="Category"
        options={categoryOptions}
        {...register('category')}
      />

      <Select
        label="Payment Method"
        options={PAYMENT_OPTIONS}
        {...register('paymentMethod')}
      />

      <Input
        label="Tags"
        placeholder="e.g. work, personal, tax (comma separated)"
        {...register('tags')}
      />

      <div className="flex gap-2 pt-2">
        <Button type="submit" loading={isSubmitting} className="flex-1">
          {initial ? 'Update' : isFuture ? 'Schedule Income' : 'Add Transaction'}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
