import { useEffect, useRef, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useAccountStore } from '../../store/useAccountStore';
import { useTransactionStore } from '../../store/useTransactionStore';
import { useUIStore } from '../../store/useUIStore';
import { suggestCategory, ALL_CATEGORIES } from '../../core/categorizer';
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
  merchant: string;
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

// ── Merchant combobox with frequent-merchant suggestions ─────────────────────

function MerchantCombobox({
  value,
  onChange,
  allTransactions,
}: {
  value: string;
  onChange: (v: string) => void;
  allTransactions: Transaction[];
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Merchants used 2+ times, grouped case-insensitively.
  // "tesco", "TESCO", "Tesco" all count together; the most-used
  // spelling becomes the canonical display name.
  const suggestions = useMemo(() => {
    // Step 1: count each exact spelling
    const exactCounts: Record<string, number> = {};
    for (const t of allTransactions) {
      if (t.merchant && !t.deletedAt) {
        exactCounts[t.merchant] = (exactCounts[t.merchant] ?? 0) + 1;
      }
    }
    // Step 2: group by lowercase key — track total uses + most-used spelling
    const groups: Record<string, { canonical: string; canonicalCount: number; total: number }> = {};
    for (const [name, count] of Object.entries(exactCounts)) {
      const key = name.trim().toLowerCase();
      if (!groups[key]) {
        groups[key] = { canonical: name, canonicalCount: count, total: count };
      } else {
        groups[key].total += count;
        if (count > groups[key].canonicalCount) {
          groups[key].canonical = name;
          groups[key].canonicalCount = count;
        }
      }
    }
    return Object.values(groups)
      .filter((g) => g.total >= 2)
      .sort((a, b) => b.total - a.total)
      .map((g) => g.canonical);
  }, [allTransactions]);

  // Filter case-insensitively so "tes" matches "Tesco", "TESCO", etc.
  const filtered = value
    ? suggestions.filter((m) => m.toLowerCase().includes(value.trim().toLowerCase()))
    : suggestions;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">Merchant / Source</label>
      <div className="relative">
        <input
          type="text"
          value={value}
          autoComplete="off"
          placeholder="e.g. Tesco, Salary"
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="w-full rounded-lg px-3 py-2 pr-8 text-sm bg-white border border-slate-300 hover:border-slate-400 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-colors duration-150"
        />
        {suggestions.length > 0 && (
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setOpen((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5"
            aria-label="Show merchant suggestions"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <path d={open ? 'M8 5.06l5.47 5.47-.94.94L8 6.94 3.47 11.47l-.94-.94z' : 'M8 10.94L2.53 5.47l.94-.94L8 9.06l4.53-4.53.94.94z'} />
            </svg>
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
          {filtered.slice(0, 8).map((m) => (
            <button
              key={m}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(m); setOpen(false); }}
              className="w-full text-left px-3 py-2.5 text-sm text-slate-800 hover:bg-slate-200 active:bg-slate-100 transition-colors flex items-center gap-2.5"
            >
              <span className="text-slate-400 text-xs shrink-0">↵</span>
              <span className="truncate">{m}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── main form ────────────────────────────────────────────────────────────────

export default function TransactionForm({ initial, onDone }: TransactionFormProps) {
  const { accounts } = useAccountStore();
  const { add, update, transactions } = useTransactionStore();
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
      merchant: initial?.merchant ?? '',
      notes: initial?.notes ?? '',
      accountId: initial?.accountId ?? defaultAccountId ?? accounts[0]?.id ?? '',
      paymentMethod: initial?.paymentMethod ?? '',
      tags: initial?.tags.join(', ') ?? '',
    },
  });

  const type = watch('type');
  const paymentTiming = watch('paymentTiming');
  const merchant = watch('merchant');
  const isFuture = type === 'income' && paymentTiming === 'future';

  // Auto-suggest category when merchant changes
  useEffect(() => {
    if (!merchant || initial?.category) return;
    const suggestion = suggestCategory(merchant);
    if (suggestion) setValue('category', suggestion.category);
  }, [merchant, setValue, initial]);

  // Reset timing to 'instant' when switching away from income
  useEffect(() => {
    if (type !== 'income') {
      setValue('paymentTiming', 'instant');
    }
  }, [type, setValue]);

  async function onSubmit(data: FormData) {
    const resolvedDate = isFuture ? data.expectedDate : data.date;

    const payload = {
      accountId: data.accountId,
      type: data.type as Transaction['type'],
      amountMinorUnits: toMinor(parseFloat(data.amount)),
      currency: accounts.find((a) => a.id === data.accountId)?.currency ?? 'GBP',
      category: data.category || 'Uncategorized',
      merchant: data.merchant || undefined,
      notes: data.notes || undefined,
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
      <div className={activeAccounts.length > 1 ? 'grid grid-cols-2 gap-3' : ''}>
        <Select
          label="Type"
          options={TYPE_OPTIONS}
          {...register('type', { required: true })}
        />
        {activeAccounts.length > 1 && (
          <Select
            label="Account"
            options={accountOptions}
            {...register('accountId')}
          />
        )}
      </div>

      {/* Single account chip */}
      {activeAccounts.length === 1 && (
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

      <MerchantCombobox
        value={merchant}
        onChange={(v) => setValue('merchant', v, { shouldDirty: true })}
        allTransactions={transactions}
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

      <Textarea
        label="Notes"
        placeholder="Any additional notes..."
        {...register('notes')}
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
