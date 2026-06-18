import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAccountStore } from '../../store/useAccountStore';
import { useTransactionStore } from '../../store/useTransactionStore';
import { useGoalStore } from '../../store/useGoalStore';
import { useUIStore } from '../../store/useUIStore';
import { useCreditCardStore } from '../../store/useCreditCardStore';
import { toMinor, formatCurrency } from '../../core/types';
import type { Transaction, FinancialGoal } from '../../core/types';
import { createPortal } from 'react-dom';
import CategorySheet from './CategorySheet';

// ── Types ──────────────────────────────────────────────────────────────────

interface FormData {
  type: 'income' | 'expense' | 'transfer';
  amount: string;
  date: string;
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
  onSaved?: (goalAchieved?: boolean) => void;
}

// ── Goal allocation preview ────────────────────────────────────────────────

function GoalAllocationPreview({
  goal,
  amountMinorUnits,
}: {
  goal: FinancialGoal;
  amountMinorUnits: number;
}) {
  const newCurrent = goal.currentMinorUnits + amountMinorUnits;
  const pctBefore = goal.targetMinorUnits > 0 ? (goal.currentMinorUnits / goal.targetMinorUnits) * 100 : 0;
  const pctAfter = goal.targetMinorUnits > 0 ? Math.min(100, (newCurrent / goal.targetMinorUnits) * 100) : 0;
  const remaining = Math.max(0, goal.targetMinorUnits - newCurrent);
  const willComplete = newCurrent >= goal.targetMinorUnits;

  return (
    <div className="mt-3 bg-sky-50 border border-sky-100 rounded-xl p-3 space-y-2.5">
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { label: 'Target', value: formatCurrency(goal.targetMinorUnits, goal.currency), color: 'text-slate-700' },
          { label: 'Already saved', value: formatCurrency(goal.currentMinorUnits, goal.currency), color: 'text-emerald-600' },
          { label: 'This expense', value: `−${formatCurrency(amountMinorUnits, goal.currency)}`, color: 'text-sky-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-lg px-2 py-1.5 text-center">
            <p className="text-xs text-slate-400 mb-0.5">{label}</p>
            <p className={`text-xs font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>{pctBefore.toFixed(0)}% before</span>
          <span className="font-semibold text-sky-600">{pctAfter.toFixed(0)}% after</span>
        </div>
        <div className="bg-sky-100 rounded-full h-2 overflow-hidden">
          <div
            className="bg-sky-500 h-full rounded-full transition-all duration-300"
            style={{ width: `${pctAfter}%` }}
          />
        </div>
      </div>

      {willComplete ? (
        <p className="text-xs font-bold text-emerald-600 bg-emerald-50 rounded-lg px-2.5 py-1.5 text-center">
          🎉 This will complete the goal!
        </p>
      ) : (
        <p className="text-xs text-slate-500 text-center">
          {formatCurrency(remaining, goal.currency)} still needed after this
        </p>
      )}
    </div>
  );
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
  const { goals, load: loadGoals, allocateAmount } = useGoalStore();
  const { defaultAccountId } = useUIStore();
  const { cards: creditCards, load: loadCreditCards, addTransaction: addCCTransaction } = useCreditCardStore();
  const [catSheetOpen, setCatSheetOpen] = useState(false);
  const [selectedCreditCardId, setSelectedCreditCardId] = useState('');

  // Allocation state (outside react-hook-form — has richer interactivity)
  const [allocType, setAllocType] = useState<'none' | 'goal'>('none');
  const [linkedGoalId, setLinkedGoalId] = useState('');

  const activeAccounts = accounts.filter((a) => !a.isArchived && !a.deletedAt);
  const activeGoals = goals.filter((g) => !g.isAchieved && !g.deletedAt);
  const defaultAcc = defaultAccountId ?? activeAccounts[0]?.id ?? '';

  // Account groups for the payment picker
  const bankAccounts = activeAccounts.filter((a) => a.type === 'checking' || a.type === 'savings');
  const cashAccounts = activeAccounts.filter((a) => a.type === 'cash');
  const creditAccounts = activeAccounts.filter((a) => a.type === 'credit');
  // Also include credit cards from the dedicated credit card store
  const activeCreditCards = creditCards.filter((c) => !c.deletedAt && c.status !== 'closed');

  type PaymentMode = 'bank' | 'cash' | 'credit' | 'other' | '';
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('bank');

  const isEdit = !!initial;
  const initScheduled =
    initial?.status === 'scheduled' || initial?.paymentTiming === 'future';

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

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
  const amountStr = watch('amount');
  const watchAccountId = watch('accountId');
  const [notesError, setNotesError] = useState('');

  const amountMinorUnits = toMinor(parseFloat(amountStr) || 0);
  const selectedGoal = activeGoals.find((g) => g.id === linkedGoalId);

  // Reset form and allocation state when drawer opens
  useEffect(() => {
    if (open) {
      loadGoals();
      loadCreditCards();
      reset({
        type: initial?.type ?? initialType,
        amount: initial ? String(initial.amountMinorUnits / 100) : '',
        date: !initScheduled ? (initial?.date?.split('T')[0] ?? todayStr) : todayStr,
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
      // Pre-fill allocation for edit
      if (initial?.allocationType === 'goal') {
        setAllocType('goal');
        setLinkedGoalId(initial.linkedGoalId ?? '');
      } else {
        setAllocType('none');
        setLinkedGoalId('');
      }
      // Restore paymentMode from existing account type
      if (initial) {
        const acc = activeAccounts.find((a) => a.id === initial.accountId);
        if (acc?.type === 'cash') setPaymentMode('cash');
        else if (acc?.type === 'credit' || initial.allocationType === 'credit_card') setPaymentMode('credit');
        else if (initial.paymentMethod === 'other') setPaymentMode('other');
        else setPaymentMode('bank');
        setSelectedCreditCardId(initial.allocationType === 'credit_card' ? (initial.linkedGoalId ?? '') : '');
      } else {
        setPaymentMode(cashAccounts.length > 0 ? 'cash' : bankAccounts.length > 0 ? 'bank' : (activeCreditCards.length > 0 || creditAccounts.length > 0) ? 'credit' : 'other');
        setSelectedCreditCardId('');
      }
      setNotesError('');
    }
  }, [open]);

  function handlePaymentModeChange(mode: PaymentMode) {
    setPaymentMode(mode);
    setNotesError('');
    setSelectedCreditCardId('');
    if (mode === 'bank') {
      setValue('paymentMethod', 'bank_transfer');
      if (bankAccounts.length > 0) setValue('accountId', bankAccounts[0].id);
    } else if (mode === 'cash') {
      setValue('paymentMethod', 'cash');
      if (cashAccounts.length > 0) setValue('accountId', cashAccounts[0].id);
    } else if (mode === 'credit') {
      setValue('paymentMethod', 'card');
      if (creditAccounts.length > 0) {
        setValue('accountId', creditAccounts[0].id);
      } else {
        setValue('accountId', defaultAcc);
        if (activeCreditCards.length > 0) setSelectedCreditCardId(activeCreditCards[0].id);
      }
    } else if (mode === 'other') {
      setValue('paymentMethod', 'other');
      setValue('accountId', defaultAcc);
    }
  }

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  async function onSubmit(data: FormData) {
    if (paymentMode === 'other' && !data.notes.trim()) {
      setNotesError('Notes are required when "Other" is selected.');
      return;
    }
    if (paymentMode === 'cash' && cashAccounts.length === 0 && type !== 'transfer') {
      setNotesError('Please add a Cash account in Settings → Accounts before recording cash transactions.');
      return;
    }
    setNotesError('');
    const account = activeAccounts.find((a) => a.id === data.accountId);
    const isScheduled = data.status === 'scheduled';

    let resolvedDate: string;
    if (isScheduled) {
      resolvedDate = data.hasFixedDate && data.scheduledDate ? data.scheduledDate : todayStr;
    } else {
      resolvedDate = data.date || todayStr;
    }

    const isGoalLinked = !isEdit && type === 'expense' && allocType === 'goal' && !!linkedGoalId;
    const goal = isGoalLinked ? activeGoals.find((g) => g.id === linkedGoalId) : undefined;

    // Determine credit card link (from useCreditCardStore)
    const isCCLinked = paymentMode === 'credit' && !!selectedCreditCardId && !creditAccounts.some((a) => a.id === watchAccountId);
    const selectedCC = isCCLinked ? activeCreditCards.find((c) => c.id === selectedCreditCardId) : undefined;

    const payload: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> = {
      // For CC-store cards: use the card's own ID as accountId so it doesn't
      // appear in any bank/cash account's balance in AccountBreakdown.
      accountId: isCCLinked && selectedCC ? selectedCC.id : data.accountId,
      toAccountId: data.type === 'transfer' && data.toAccountId ? data.toAccountId : undefined,
      type: data.type,
      amountMinorUnits: toMinor(parseFloat(data.amount) || 0),
      currency: account?.currency ?? (selectedCC?.currency ?? 'GBP'),
      category: data.category || 'Uncategorized',
      notes: data.notes || undefined,
      date: resolvedDate,
      paymentMethod: (data.paymentMethod as Transaction['paymentMethod']) || undefined,
      paymentTiming: isScheduled ? 'future' : 'instant',
      status: data.status,
      hasFixedScheduleDate: isScheduled ? data.hasFixedDate : undefined,
      tags: data.tags.split(',').map((t) => t.trim()).filter(Boolean),
      isRecurring: false,
      // Allocation — goal takes priority over credit card
      allocationType: isGoalLinked ? 'goal' : isCCLinked ? 'credit_card' : (isEdit ? initial?.allocationType : undefined),
      linkedGoalId: isGoalLinked ? linkedGoalId : isCCLinked ? selectedCreditCardId : (isEdit ? initial?.linkedGoalId : undefined),
      linkedEntityName: isGoalLinked ? goal?.name : isCCLinked ? selectedCC?.name : (isEdit ? initial?.linkedEntityName : undefined),
    };

    if (isEdit && initial) {
      await update(initial.id, payload);
      onSaved?.();
    } else {
      await add(payload);
      // Allocate to goal after transaction is saved
      let achieved = false;
      if (isGoalLinked) {
        achieved = await allocateAmount(linkedGoalId, payload.amountMinorUnits);
      }
      // Track spend on the linked credit card
      if (isCCLinked && selectedCC && payload.type === 'expense') {
        await addCCTransaction(selectedCC.id, {
          merchant: payload.notes || payload.category || 'Expense',
          category: payload.category,
          amountMinorUnits: payload.amountMinorUnits,
          currency: selectedCC.currency,
          date: resolvedDate,
          notes: payload.notes,
        });
      }
      onSaved?.(achieved);
    }

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
          <div className="overflow-y-auto overflow-x-hidden flex-1 overscroll-contain">

            {/* ── Type pills ────────────────────────────────────────── */}
            <div className="px-5 pt-4 pb-3">
              <div className="flex gap-2 bg-slate-100 rounded-2xl p-1">
                {(['income', 'expense', 'transfer'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setValue('type', t); if (t !== 'expense') { setAllocType('none'); setLinkedGoalId(''); } }}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all capitalize ${
                      type === t
                        ? t === 'income' ? 'bg-emerald-500 text-white shadow-sm'
                          : t === 'expense' ? 'bg-red-500 text-white shadow-sm'
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
              <div className={`rounded-2xl p-4 ${type === 'income' ? 'bg-emerald-50' : type === 'expense' ? 'bg-red-50' : 'bg-blue-50'}`}>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Amount <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className={`text-2xl font-bold ${type === 'income' ? 'text-emerald-600' : type === 'expense' ? 'text-red-600' : 'text-blue-600'}`}>£</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    {...register('amount', { required: 'Amount is required', min: { value: 0.01, message: 'Must be > 0' } })}
                    className={`flex-1 bg-transparent text-3xl font-bold placeholder-slate-300 focus:outline-none ${type === 'income' ? 'text-emerald-700' : type === 'expense' ? 'text-red-700' : 'text-blue-700'}`}
                  />
                </div>
                {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>}
              </div>
            </div>

            {/* ── Status toggle ─────────────────────────────────────── */}
            <div className="px-5 pb-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Status</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setValue('status', 'completed')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-all ${status === 'completed' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                  <span>✓</span> Completed
                </button>
                <button type="button" onClick={() => setValue('status', 'scheduled')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-all ${status === 'scheduled' ? 'bg-purple-50 border-purple-200 text-purple-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                  <span>⏳</span> Scheduled
                </button>
              </div>
            </div>

            {/* ── Date ──────────────────────────────────────────────── */}
            {status === 'completed' && (
              <div className="px-5 pb-4">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Date <span className="text-red-500">*</span>
                </label>
                <input type="date" {...register('date', { required: true })} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}

            {/* ── Scheduled date ────────────────────────────────────── */}
            {status === 'scheduled' && (
              <div className="px-5 pb-4">
                <div className="p-4 bg-purple-50 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-purple-800">Expected Date</p>
                      <p className="text-xs text-purple-500 mt-0.5">Leave off if date is not yet known</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" {...register('hasFixedDate')} />
                      <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:bg-purple-500 peer-checked:after:translate-x-full after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform" />
                    </label>
                  </div>
                  {hasFixedDate && <input type="date" {...register('scheduledDate')} className="w-full px-3 py-2.5 rounded-xl border border-purple-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400" />}
                  {!hasFixedDate && <p className="text-xs font-medium text-purple-600 bg-purple-100 px-3 py-2 rounded-lg">📅 No fixed date — will show as &quot;No fixed date&quot; in the list</p>}
                </div>
              </div>
            )}

            {/* ── Payment Method (unified picker) ───────────────────── */}
            <div className="px-5 pb-4">
              {type === 'transfer' ? (
                /* Transfer: keep simple From / To selectors */
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                      From Account <span className="text-red-500">*</span>
                    </label>
                    <select {...register('accountId', { required: true })} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {activeAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                      To Account <span className="text-red-500">*</span>
                    </label>
                    <select {...register('toAccountId')} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Select...</option>
                      {activeAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                </div>
              ) : (
                /* Income / Expense: smart payment mode picker */
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Payment Method <span className="text-red-500">*</span>
                  </label>

                  {/* 4-mode top row */}
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {([
                      { id: 'bank',   emoji: '🏦', label: 'Bank' },
                      { id: 'cash',   emoji: '💵', label: 'Cash' },
                      { id: 'credit', emoji: '💳', label: 'Credit' },
                      { id: 'other',  emoji: '📌', label: 'Other' },
                    ] as const).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handlePaymentModeChange(m.id)}
                        className={`flex flex-col items-center gap-1 py-3 rounded-xl border transition-all active:scale-95 ${
                          paymentMode === m.id
                            ? 'bg-blue-50 border-blue-300 shadow-sm'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <span className="text-xl leading-none">{m.emoji}</span>
                        <span className={`text-xs font-semibold ${paymentMode === m.id ? 'text-blue-700' : 'text-slate-600'}`}>
                          {m.label}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Bank sub-picker */}
                  {paymentMode === 'bank' && (
                    bankAccounts.length > 0 ? (
                      <div className="space-y-1.5">
                        <p className="text-xs text-slate-400 mb-1.5">Select bank account</p>
                        {bankAccounts.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => setValue('accountId', a.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                              watchAccountId === a.id
                                ? 'bg-blue-50 border-blue-300'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                            <span className={`text-sm font-medium flex-1 truncate ${watchAccountId === a.id ? 'text-blue-700' : 'text-slate-800'}`}>
                              {a.name}
                            </span>
                            <span className="text-xs text-slate-400 capitalize">{a.type}</span>
                            {watchAccountId === a.id && (
                              <svg className="h-4 w-4 text-blue-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 bg-slate-50 rounded-xl px-3 py-2.5">
                        No bank accounts added yet — go to Settings → Accounts.
                      </p>
                    )
                  )}

                  {/* Credit card sub-picker */}
                  {paymentMode === 'credit' && (
                    creditAccounts.length > 0 || activeCreditCards.length > 0 ? (
                      <div className="space-y-1.5">
                        <p className="text-xs text-slate-400 mb-1.5">Select credit card</p>
                        {/* Cards from Account store (type === 'credit') */}
                        {creditAccounts.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => { setValue('accountId', a.id); setSelectedCreditCardId(''); }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                              watchAccountId === a.id && !selectedCreditCardId
                                ? 'bg-blue-50 border-blue-300'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                            <span className={`text-sm font-medium flex-1 truncate ${watchAccountId === a.id && !selectedCreditCardId ? 'text-blue-700' : 'text-slate-800'}`}>
                              {a.name}
                            </span>
                            <span className="text-xs text-slate-400">Account</span>
                            {watchAccountId === a.id && !selectedCreditCardId && (
                              <svg className="h-4 w-4 text-blue-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                        ))}
                        {/* Cards from CreditCard store */}
                        {activeCreditCards.map((cc) => (
                          <button
                            key={cc.id}
                            type="button"
                            onClick={() => { setSelectedCreditCardId(cc.id); setValue('accountId', defaultAcc); }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                              selectedCreditCardId === cc.id
                                ? 'bg-blue-50 border-blue-300'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cc.color }} />
                            <div className={`flex-1 min-w-0`}>
                              <span className={`text-sm font-medium block truncate ${selectedCreditCardId === cc.id ? 'text-blue-700' : 'text-slate-800'}`}>
                                {cc.name}
                              </span>
                              <span className="text-xs text-slate-400">···· {cc.last4}</span>
                            </div>
                            <span className="text-xs text-slate-400 capitalize shrink-0">{cc.network}</span>
                            {selectedCreditCardId === cc.id && (
                              <svg className="h-4 w-4 text-blue-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 bg-slate-50 rounded-xl px-3 py-2.5">
                        No credit cards added yet — add one in the Credit Cards tab.
                      </p>
                    )
                  )}

                  {/* Cash: show cash accounts only */}
                  {paymentMode === 'cash' && (
                    cashAccounts.length > 0 ? (
                      <div className="space-y-1.5">
                        {cashAccounts.length > 1 && (
                          <p className="text-xs text-slate-400 mb-1.5">Select cash account</p>
                        )}
                        {cashAccounts.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => setValue('accountId', a.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                              watchAccountId === a.id
                                ? 'bg-emerald-50 border-emerald-300'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <span className="text-base">💵</span>
                            <span className={`text-sm font-medium flex-1 truncate ${watchAccountId === a.id ? 'text-emerald-700' : 'text-slate-800'}`}>
                              {a.name}
                            </span>
                            {watchAccountId === a.id && (
                              <svg className="h-4 w-4 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 bg-slate-50 rounded-xl px-3 py-2.5">
                        No cash account added yet — go to Settings → Accounts.
                      </p>
                    )
                  )}

                  {/* Other: only the mandatory notes notice */}
                  {paymentMode === 'other' && (
                    <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-xl">
                      <span className="text-amber-500 text-sm mt-0.5">⚠</span>
                      <p className="text-xs text-amber-700 font-medium">Notes are required for "Other" payments — describe below.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Notes / Remark ────────────────────────────────────── */}
            <div className="px-5 pb-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Notes / Remark{paymentMode === 'other' && <span className="text-red-500 ml-1">*</span>}
              </label>
              <textarea
                rows={3}
                placeholder={paymentMode === 'other' ? 'Required — describe this payment...' : 'Describe this transaction... (optional)'}
                {...register('notes')}
                className={`w-full px-4 py-3 rounded-xl border text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 resize-none ${notesError ? 'border-red-300 focus:ring-red-400' : 'border-slate-200 focus:ring-blue-500'}`}
              />
              {notesError && <p className="text-xs text-red-500 mt-1">{notesError}</p>}
            </div>

            {/* ── Category ──────────────────────────────────────────── */}
            <div className="px-5 pb-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Category</label>
              <button type="button" onClick={() => setCatSheetOpen(true)} className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm hover:border-blue-300 transition-colors">
                <span className={category ? 'text-slate-900 font-medium' : 'text-slate-400'}>{category || 'Select category...'}</span>
                <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* ── Allocate this transaction (expense only, new only) ─── */}
            {type === 'expense' && !isEdit && (
              <div className="px-5 pb-4">
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Allocate this transaction</p>
                    <p className="text-xs text-slate-400 mt-0.5">Link this spend to a goal</p>
                  </div>
                  <div className="p-4">
                    {/* Allocation type buttons */}
                    <div className="flex gap-2 mb-1">
                      <button
                        type="button"
                        onClick={() => { setAllocType('none'); setLinkedGoalId(''); }}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all ${allocType === 'none' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                      >
                        Normal Expense
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllocType('goal')}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all ${allocType === 'goal' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-500 border-slate-200 hover:border-sky-200'}`}
                      >
                        🎯 Goal
                      </button>
                    </div>

                    {/* Goal selector */}
                    {allocType === 'goal' && (
                      <div className="mt-3">
                        {activeGoals.length === 0 ? (
                          <p className="text-sm text-slate-400 text-center py-3">
                            No active goals yet. Create one in the Goals tab first.
                          </p>
                        ) : (
                          <>
                            <select
                              value={linkedGoalId}
                              onChange={(e) => setLinkedGoalId(e.target.value)}
                              className="w-full px-4 py-3 rounded-xl border border-sky-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400"
                            >
                              <option value="">Select a goal…</option>
                              {activeGoals.map((g) => (
                                <option key={g.id} value={g.id}>
                                  🎯 {g.name} — {formatCurrency(g.targetMinorUnits - g.currentMinorUnits, g.currency)} remaining
                                </option>
                              ))}
                            </select>

                            {selectedGoal && amountMinorUnits > 0 && (
                              <GoalAllocationPreview
                                goal={selectedGoal}
                                amountMinorUnits={amountMinorUnits}
                              />
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Edit: show existing goal link (read-only) ─────────── */}
            {isEdit && initial?.allocationType === 'goal' && initial.linkedEntityName && (
              <div className="px-5 pb-4">
                <div className="flex items-center gap-2 bg-sky-50 border border-sky-100 rounded-xl px-4 py-3">
                  <span className="text-lg">🎯</span>
                  <div>
                    <p className="text-xs font-semibold text-sky-700">Linked to Goal</p>
                    <p className="text-sm font-medium text-slate-800">{initial.linkedEntityName}</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Tags ──────────────────────────────────────────────── */}
            <div className="px-5 pb-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Tags</label>
              <input type="text" placeholder="e.g. work, personal, tax (comma separated)" {...register('tags')} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {/* spacer */}
            <div className="pb-2" />
          </div>

          {/* ── Sticky save button ─────────────────────────────────── */}
          <div className="shrink-0 px-5 py-4 border-t border-slate-100 bg-white flex gap-3">
            <button type="button" onClick={onClose} className="px-5 py-3.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (allocType === 'goal' && !linkedGoalId && activeGoals.length > 0)}
              className={`flex-1 py-3.5 rounded-xl text-white font-bold text-sm transition-colors disabled:opacity-60 ${
                allocType === 'goal' ? 'bg-sky-600 hover:bg-sky-700'
                  : type === 'income' ? 'bg-emerald-600 hover:bg-emerald-700'
                  : type === 'expense' ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSubmitting ? 'Saving…'
                : isEdit ? 'Update Transaction'
                : allocType === 'goal' && linkedGoalId ? 'Save & Update Goal'
                : 'Save Transaction'}
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
