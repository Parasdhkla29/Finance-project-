import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAccountStore } from '../../store/useAccountStore';
import { useTransactionStore } from '../../store/useTransactionStore';
import { useUIStore } from '../../store/useUIStore';
import { toMinor } from '../../core/types';
import type { Transaction } from '../../core/types';
import { createPortal } from 'react-dom';
import CategorySheet from './CategorySheet';
import { PAYMENT_MODE_LABELS } from './FilterSheets';

// ── Types ──────────────────────────────────────────────────────────────────

interface FormData {
  type: 'income' | 'expense' | 'transfer';
  amount: string;
  date: string;
  time: string;
  accountId: string;
  toAccountId: string;
  category: string;
  paymentMethod: string;
  status: 'completed' | 'scheduled';
  hasFixedDate: boolean;
  scheduledDate: string;
  tags: string;
  notes: string;
}

interface TransactionDrawerProps {
  open: boolean;
  onClose: () => void;
  initialType?: 'income' | 'expense' | 'transfer';
  initial?: Transaction;
  onSaved?: () => void;
}

// ── Main Drawer ────────────────────────────────────────────────────────────

export default function TransactionDrawer({
  open,
  onClose,
  initialType = 'expense',
  initial,
  onSaved,
}: TransactionDrawerProps) {
  const { accounts } = useAccountStore();
  const { add, update } = useTransactionStore();
  const { defaultAccountId } = useUIStore();
  const [catSheetOpen, setCatSheetOpen] = useState(false);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);

  const activeAccounts = accounts.filter((a) => !a.isArchived && !a.deletedAt);
  const defaultAcc = defaultAccountId ?? activeAccounts[0]?.id ?? '';

  const isEdit = !!initial;
  const initScheduled =
    initial?.status === 'scheduled' || initial?.paymentTiming === 'future';

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      type: initial?.type ?? initialType,
      amount: initial ? String(initial.amountMinorUnits / 100) : '',
      date: !initScheduled ? (initial?.date?.split('T')[0] ?? todayStr) : todayStr,
      time: timeStr,
      accountId: initial?.accountId ?? defaultAcc,
      toAccountId: initial?.toAccountId ?? '',
      category: initial?.category ?? '',
      paymentMethod: initial?.paymentMethod ?? '',
      status: initScheduled ? 'scheduled' : 'completed',
      hasFixedDate: initScheduled ? (initial?.hasFixedScheduleDate ?? false) : true,
      scheduledDate: initScheduled && initial?.hasFixedScheduleDate ? initial.date.split('T')[0] : '',
      tags: initial?.tags.join(', ') ?? '',
      notes: initial?.notes ?? '',
    },
  });

  const type = watch('type');
  const status = watch('status');
  const hasFixedDate = watch('hasFixedDate');
  const category = watch('category');
  const paymentMethod = watch('paymentMethod');

  // Reset form when drawer opens/closes
  useEffect(() => {
    if (open) {
      reset({
        type: initial?.type ?? initialType,
        amount: initial ? String(initial.amountMinorUnits / 100) : '',
        date: !initScheduled ? (initial?.date?.split('T')[0] ?? todayStr) : todayStr,
        time: timeStr,
        accountId: initial?.accountId ?? defaultAcc,
        toAccountId: initial?.toAccountId ?? '',
        category: initial?.category ?? '',
        paymentMethod: initial?.paymentMethod ?? '',
        status: initScheduled ? 'scheduled' : 'completed',
        hasFixedDate: initScheduled ? (initial?.hasFixedScheduleDate ?? false) : true,
        scheduledDate:
          initScheduled && initial?.hasFixedScheduleDate ? initial.date.split('T')[0] : '',
        tags: initial?.tags.join(', ') ?? '',
        notes: initial?.notes ?? '',
      });
    }
  }, [open]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  async function onSubmit(data: FormData) {
    const account = activeAccounts.find((a) => a.id === data.accountId);
    const isScheduled = data.status === 'scheduled';

    let resolvedDate: string;
    if (isScheduled) {
      resolvedDate = data.hasFixedDate && data.scheduledDate ? data.scheduledDate : todayStr;
    } else {
      resolvedDate = data.date || todayStr;
    }

    const payload: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> = {
      accountId: data.accountId,
      toAccountId: data.type === 'transfer' && data.toAccountId ? data.toAccountId : undefined,
      type: data.type,
      amountMinorUnits: toMinor(parseFloat(data.amount) || 0),
      currency: account?.currency ?? 'GBP',
      category: data.category || 'Uncategorized',
      notes: data.notes || undefined,
      date: resolvedDate,
      paymentMethod: (data.paymentMethod as Transaction['paymentMethod']) || undefined,
      paymentTiming: isScheduled ? 'future' : 'instant',
      status: data.status,
      hasFixedScheduleDate: isScheduled ? data.hasFixedDate : undefined,
      tags: data.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      isRecurring: false,
    };

    if (isEdit && initial) {
      await update(initial.id, payload);
    } else {
      await add(payload);
    }

    onSaved?.();
    onClose();
  }

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm fade-in" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-full bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[96dvh] sheet-slide-up">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0" aria-hidden="true">
          <div className="w-10 h-1.5 bg-slate-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 className="text-base font-bold text-slate-900">
            {isEdit ? 'Edit Transaction' : 'Add Transaction'}
          </h2>
          {isEdit ? (
            <button className="w-8 h-8 rounded-xl flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9z" clipRule="evenodd" />
              </svg>
            </button>
          ) : (
            <div className="w-8" />
          )}
        </div>

        {/* Scrollable form body */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto flex-1 overscroll-contain">
            {/* ── Type pills ────────────────────────────────────────── */}
            <div className="px-5 pt-4 pb-3">
              <div className="flex gap-2 bg-slate-100 rounded-2xl p-1">
                {(['income', 'expense', 'transfer'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setValue('type', t)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all capitalize ${
                      type === t
                        ? t === 'income'
                          ? 'bg-emerald-500 text-white shadow-sm'
                          : t === 'expense'
                            ? 'bg-red-500 text-white shadow-sm'
                            : 'bg-blue-500 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Amount ────────────────────────────────────────────── */}
            <div className="px-5 pb-4">
              <div
                className={`rounded-2xl p-4 ${
                  type === 'income'
                    ? 'bg-emerald-50'
                    : type === 'expense'
                      ? 'bg-red-50'
                      : 'bg-blue-50'
                }`}
              >
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Amount <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-2xl font-bold ${
                      type === 'income'
                        ? 'text-emerald-600'
                        : type === 'expense'
                          ? 'text-red-600'
                          : 'text-blue-600'
                    }`}
                  >
                    £
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    {...register('amount', {
                      required: 'Amount is required',
                      min: { value: 0.01, message: 'Must be > 0' },
                    })}
                    className={`flex-1 bg-transparent text-3xl font-bold placeholder-slate-300 focus:outline-none ${
                      type === 'income'
                        ? 'text-emerald-700'
                        : type === 'expense'
                          ? 'text-red-700'
                          : 'text-blue-700'
                    }`}
                  />
                </div>
                {errors.amount && (
                  <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>
                )}
              </div>
            </div>

            {/* ── Status toggle ─────────────────────────────────────── */}
            <div className="px-5 pb-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Status
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setValue('status', 'completed')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                    status === 'completed'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <span>✓</span> Completed
                </button>
                <button
                  type="button"
                  onClick={() => setValue('status', 'scheduled')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                    status === 'scheduled'
                      ? 'bg-purple-50 border-purple-200 text-purple-700'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <span>⏳</span> Scheduled
                </button>
              </div>
            </div>

            {/* ── Date / Time ───────────────────────────────────────── */}
            {status === 'completed' && (
              <div className="px-5 pb-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    {...register('date', { required: true })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    Time
                  </label>
                  <input
                    type="time"
                    {...register('time')}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* ── Scheduled date ────────────────────────────────────── */}
            {status === 'scheduled' && (
              <div className="px-5 pb-4">
                <div className="p-4 bg-purple-50 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-purple-800">Expected Date</p>
                      <p className="text-xs text-purple-500 mt-0.5">
                        Leave off if date is not yet known
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        {...register('hasFixedDate')}
                      />
                      <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:bg-purple-500 peer-checked:after:translate-x-full after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform" />
                    </label>
                  </div>
                  {hasFixedDate && (
                    <input
                      type="date"
                      {...register('scheduledDate')}
                      className="w-full px-3 py-2.5 rounded-xl border border-purple-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  )}
                  {!hasFixedDate && (
                    <p className="text-xs font-medium text-purple-600 bg-purple-100 px-3 py-2 rounded-lg">
                      📅 No fixed date — will show as &quot;No fixed date&quot; in the list
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── Account ───────────────────────────────────────────── */}
            <div className={`px-5 pb-4 ${type === 'transfer' ? 'grid grid-cols-2 gap-3' : ''}`}>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  {type === 'transfer' ? 'From Account' : 'Account'} <span className="text-red-500">*</span>
                </label>
                <select
                  {...register('accountId', { required: true })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {activeAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              {type === 'transfer' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    To Account <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register('toAccountId')}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select...</option>
                    {activeAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* ── Notes / Remark ────────────────────────────────────── */}
            <div className="px-5 pb-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Notes / Remark <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Describe this transaction..."
                {...register('notes', { required: 'Notes is required' })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              {errors.notes && (
                <p className="text-xs text-red-500 mt-1">{errors.notes.message}</p>
              )}
            </div>

            {/* ── Category ──────────────────────────────────────────── */}
            <div className="px-5 pb-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Category
              </label>
              <button
                type="button"
                onClick={() => setCatSheetOpen(true)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm hover:border-blue-300 transition-colors"
              >
                <span className={category ? 'text-slate-900 font-medium' : 'text-slate-400'}>
                  {category || 'Select category...'}
                </span>
                <svg
                  className="h-4 w-4 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* ── Payment Mode ───────────────────────────────────────── */}
            <div className="px-5 pb-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Payment Mode
              </label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(PAYMENT_MODE_LABELS).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setValue('paymentMethod', paymentMethod === id ? '' : id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                      paymentMethod === id
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Tags ──────────────────────────────────────────────── */}
            <div className="px-5 pb-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Tags
              </label>
              <input
                type="text"
                placeholder="e.g. work, personal, tax (comma separated)"
                {...register('tags')}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* spacer */}
            <div className="pb-2" />
          </div>

          {/* ── Sticky save button ─────────────────────────────────── */}
          <div className="shrink-0 px-5 py-4 border-t border-slate-100 bg-white flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 py-3.5 rounded-xl text-white font-bold text-sm transition-colors disabled:opacity-60 ${
                type === 'income'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : type === 'expense'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSubmitting ? 'Saving…' : isEdit ? 'Update Transaction' : 'Save Transaction'}
            </button>
          </div>
        </form>
      </div>

      {/* Category Sheet (nested portal) */}
      <CategorySheet
        open={catSheetOpen}
        onClose={() => setCatSheetOpen(false)}
        selected={category}
        onSelect={(cat) => setValue('category', cat)}
      />
    </div>,
    document.body,
  );
}
