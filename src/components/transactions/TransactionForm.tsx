import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useAccountStore } from '../../store/useAccountStore';
import { useTransactionStore } from '../../store/useTransactionStore';
import { suggestCategory, ALL_CATEGORIES } from '../../core/categorizer';
import { toMinor } from '../../core/types';
import type { Transaction } from '../../core/types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Textarea from '../ui/Textarea';

interface FormData {
  type: 'income' | 'expense' | 'transfer';
  amount: string;
  date: string;
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

export default function TransactionForm({ initial, onDone }: TransactionFormProps) {
  const { accounts } = useAccountStore();
  const { add, update } = useTransactionStore();

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
      date: initial?.date ?? new Date().toISOString().split('T')[0],
      category: initial?.category ?? '',
      merchant: initial?.merchant ?? '',
      notes: initial?.notes ?? '',
      accountId: initial?.accountId ?? accounts[0]?.id ?? '',
      paymentMethod: initial?.paymentMethod ?? '',
      tags: initial?.tags.join(', ') ?? '',
    },
  });

  const merchant = watch('merchant');

  // Auto-suggest category when merchant changes
  useEffect(() => {
    if (!merchant || initial?.category) return;
    const suggestion = suggestCategory(merchant);
    if (suggestion) setValue('category', suggestion.category);
  }, [merchant, setValue, initial]);

  async function onSubmit(data: FormData) {
    const payload = {
      accountId: data.accountId,
      type: data.type as Transaction['type'],
      amountMinorUnits: toMinor(parseFloat(data.amount)),
      currency: accounts.find((a) => a.id === data.accountId)?.currency ?? 'GBP',
      category: data.category || 'Uncategorized',
      merchant: data.merchant || undefined,
      notes: data.notes || undefined,
      date: data.date,
      paymentMethod: (data.paymentMethod as Transaction['paymentMethod']) || undefined,
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

  const accountOptions = accounts
    .filter((a) => !a.isArchived && !a.deletedAt)
    .map((a) => ({ value: a.id, label: a.name }));

  const categoryOptions = ['', ...ALL_CATEGORIES].map((c) => ({
    value: c,
    label: c || 'Select category',
  }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Select
        label="Type"
        options={TYPE_OPTIONS}
        {...register('type', { required: true })}
      />

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
        <Input
          label="Date"
          type="date"
          required
          error={errors.date?.message}
          {...register('date', { required: 'Date is required' })}
        />
      </div>

      <Input
        label="Merchant / Source"
        placeholder="e.g. Tesco, Salary"
        {...register('merchant')}
      />

      <Select
        label="Category"
        options={categoryOptions}
        {...register('category')}
      />

      {accountOptions.length > 0 && (
        <Select
          label="Account"
          options={accountOptions}
          {...register('accountId')}
        />
      )}

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
          {initial ? 'Update' : 'Add Transaction'}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
