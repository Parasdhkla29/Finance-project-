import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { format, parseISO, isToday, isYesterday, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from 'date-fns';
import { useTransactionStore } from '../store/useTransactionStore';
import { useAccountStore } from '../store/useAccountStore';
import type { Transaction } from '../core/types';
import { formatCurrency, isScheduled as isTxnScheduled } from '../core/types';
import TransactionDrawer from '../components/transactions/TransactionDrawer';
import CategorySheet from '../components/transactions/CategorySheet';
import {
  DateFilterSheet,
  TypeFilterSheet,
  AccountFilterSheet,
  CategoryFilterSheet,
  PaymentModeFilterSheet,
  StatusFilterSheet,
  TagsFilterSheet,
  PAYMENT_MODE_LABELS,
} from '../components/transactions/FilterSheets';
import type { DateFilter } from '../components/transactions/FilterSheets';
import ReportSheet from '../components/transactions/ReportSheet';
import { CATEGORY_EMOJIS } from '../components/transactions/CategorySheet';

// ── Toast ─────────────────────────────────────────────────────────────────

function Toast({ msg }: { msg: string }) {
  return (
    <div
      className="fixed bottom-24 left-1/2 z-[500] toast-pop"
      style={{ transform: 'translateX(-50%)' }}
      role="status"
      aria-live="polite"
    >
      <div className="bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-xl whitespace-nowrap">
        {msg}
      </div>
    </div>
  );
}

// ── Filter chip ───────────────────────────────────────────────────────────

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border transition-all whitespace-nowrap ${
        active
          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
      }`}
    >
      {label}
      {active && (
        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </button>
  );
}

// ── Date group header ─────────────────────────────────────────────────────

function DateGroupHeader({ dateKey }: { dateKey: string }) {
  let label: string;
  if (dateKey === 'no-date') {
    label = '📅 No Fixed Date';
  } else {
    try {
      const d = parseISO(dateKey);
      if (isToday(d)) label = 'Today · ' + format(d, 'd MMM yyyy');
      else if (isYesterday(d)) label = 'Yesterday · ' + format(d, 'd MMM yyyy');
      else label = format(d, 'EEEE · d MMM yyyy');
    } catch {
      label = dateKey;
    }
  }

  return (
    <div className="flex items-center gap-3 mb-3">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
        {label}
      </p>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  );
}

// ── Summary card ──────────────────────────────────────────────────────────

function SummaryCard({
  income,
  expense,
  net,
  scheduledIncome,
  scheduledExpense,
  count,
}: {
  income: number;
  expense: number;
  net: number;
  scheduledIncome: number;
  scheduledExpense: number;
  count: number;
}) {
  return (
    <div className="mx-4 mb-4 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Net */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Net Balance</p>
            <p
              className={`text-2xl font-bold mt-0.5 ${
                net >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              {net >= 0 ? '+' : ''}{formatCurrency(net, 'GBP')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">{count} transaction{count !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* Income / Expense / Scheduled */}
      <div className="grid grid-cols-3 divide-x divide-slate-100">
        <div className="px-3 py-3 text-center">
          <p className="text-xs text-slate-400 mb-1">Income</p>
          <p className="text-sm font-bold text-emerald-600">+{formatCurrency(income, 'GBP')}</p>
        </div>
        <div className="px-3 py-3 text-center">
          <p className="text-xs text-slate-400 mb-1">Expenses</p>
          <p className="text-sm font-bold text-red-600">-{formatCurrency(expense, 'GBP')}</p>
        </div>
        <div className="px-3 py-3 text-center">
          <p className="text-xs text-slate-400 mb-1">Scheduled</p>
          <p className="text-sm font-bold text-purple-600">
            {formatCurrency(scheduledIncome + scheduledExpense, 'GBP')}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Transaction card (completed) ──────────────────────────────────────────

function TxnCard({
  txn,
  onEdit,
  onDelete,
}: {
  txn: Transaction;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showActions, setShowActions] = useState(false);

  const borderColor =
    txn.type === 'income'
      ? 'bg-emerald-500'
      : txn.type === 'expense'
        ? 'bg-red-500'
        : 'bg-blue-500';

  const amountColor =
    txn.type === 'income'
      ? 'text-emerald-600'
      : txn.type === 'expense'
        ? 'text-red-600'
        : 'text-blue-600';

  const amountPrefix = txn.type === 'income' ? '+' : txn.type === 'expense' ? '−' : '';

  return (
    <div
      className="bg-white rounded-xl border border-slate-100 overflow-hidden mb-2 shadow-sm"
      onClick={() => setShowActions((v) => !v)}
    >
      <div className="flex">
        {/* Color bar */}
        <div className={`w-1 shrink-0 ${borderColor}`} />

        {/* Content */}
        <div className="flex-1 px-3 py-3 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {/* Title: notes > merchant > category */}
              <p className="text-sm font-semibold text-slate-900 truncate">
                {txn.notes || txn.merchant || txn.category}
              </p>

              {/* Chips row */}
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {txn.category && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                    <span>{CATEGORY_EMOJIS[txn.category] ?? '📌'}</span>
                    {txn.category}
                  </span>
                )}
                {txn.paymentMethod && (
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs font-medium">
                    {PAYMENT_MODE_LABELS[txn.paymentMethod] ?? txn.paymentMethod}
                  </span>
                )}
              </div>

              {/* Date */}
              <p className="text-xs text-slate-400 mt-1">
                {format(parseISO(txn.date), 'd MMM · HH:mm')}
              </p>

              {/* Tags */}
              {txn.tags.length > 0 && (
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {txn.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-slate-50 border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Amount */}
            <div className="text-right shrink-0">
              <p className={`text-base font-bold ${amountColor}`}>
                {amountPrefix}{formatCurrency(txn.amountMinorUnits, txn.currency)}
              </p>
            </div>
          </div>

          {/* Action row (visible on tap) */}
          {showActions && (
            <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
                Edit
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9z" clipRule="evenodd" />
                </svg>
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Scheduled card ────────────────────────────────────────────────────────

function ScheduledCard({
  txn,
  onMarkCompleted,
  onEdit,
  onDelete,
}: {
  txn: Transaction;
  onMarkCompleted: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showActions, setShowActions] = useState(false);

  const ctaLabel =
    txn.type === 'income'
      ? 'MARK RECEIVED TODAY'
      : txn.type === 'expense'
        ? 'MARK PAID TODAY'
        : 'MARK TRANSFERRED TODAY';

  const ctaColor =
    txn.type === 'income'
      ? 'bg-emerald-600 text-white'
      : txn.type === 'expense'
        ? 'bg-red-600 text-white'
        : 'bg-blue-600 text-white';

  const dateText = txn.hasFixedScheduleDate
    ? `Expected ${format(parseISO(txn.date), 'd MMM yyyy')}`
    : 'No fixed date';

  return (
    <div
      className="bg-purple-50 border border-purple-100 rounded-xl overflow-hidden mb-2 shadow-sm"
      onClick={() => setShowActions((v) => !v)}
    >
      <div className="flex">
        {/* Purple bar */}
        <div className="w-1 shrink-0 bg-purple-500" />

        <div className="flex-1 px-3 py-3 min-w-0">
          {/* Status + type badges */}
          <div className="flex items-center gap-1.5 mb-2">
            <span className="px-2 py-0.5 bg-purple-200 text-purple-800 rounded-full text-xs font-bold">
              ⏳ Scheduled
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                txn.type === 'income'
                  ? 'bg-emerald-100 text-emerald-700'
                  : txn.type === 'expense'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-blue-100 text-blue-700'
              }`}
            >
              {txn.type.charAt(0).toUpperCase() + txn.type.slice(1)}
            </span>
          </div>

          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {/* Title: notes > merchant > category */}
              <p className="text-sm font-semibold text-slate-900 truncate">
                {txn.notes || txn.merchant || txn.category}
              </p>

              {/* Category chip */}
              {txn.category && (
                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-white text-slate-600 rounded-full text-xs font-medium border border-slate-200">
                  <span>{CATEGORY_EMOJIS[txn.category] ?? '📌'}</span>
                  {txn.category}
                </span>
              )}

              {/* Date */}
              <p className={`text-xs font-medium mt-1 ${txn.hasFixedScheduleDate ? 'text-purple-600' : 'text-slate-400'}`}>
                {dateText}
              </p>
            </div>

            {/* Amount */}
            <div className="text-right shrink-0">
              <p
                className={`text-base font-bold ${
                  txn.type === 'income'
                    ? 'text-emerald-600'
                    : txn.type === 'expense'
                      ? 'text-red-600'
                      : 'text-blue-600'
                }`}
              >
                {txn.type === 'income' ? '+' : '−'}
                {formatCurrency(txn.amountMinorUnits, txn.currency)}
              </p>
            </div>
          </div>

          {/* CTA button — always visible */}
          <button
            onClick={(e) => { e.stopPropagation(); onMarkCompleted(); }}
            className={`w-full mt-3 py-2 rounded-xl text-xs font-bold tracking-wide ${ctaColor} active:opacity-80 transition-opacity`}
          >
            {ctaLabel}
          </button>

          {/* Edit/Delete on tap */}
          {showActions && (
            <div className="flex gap-2 mt-2">
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-blue-700 text-xs font-semibold border border-blue-200 hover:bg-blue-50 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
                Edit
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-red-600 text-xs font-semibold border border-red-200 hover:bg-red-50 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9z" clipRule="evenodd" />
                </svg>
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Delete confirm overlay ────────────────────────────────────────────────

function DeleteConfirm({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[450] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl">
        <h3 className="text-base font-bold text-slate-900 mb-2">Delete Transaction?</h3>
        <p className="text-sm text-slate-500 mb-5">
          This action cannot be undone. The transaction will be removed.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl text-sm hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl text-sm hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Date filter helpers ───────────────────────────────────────────────────

function applyDateFilter(t: Transaction, filter: DateFilter): boolean {
  if (filter.type === 'all') return true;
  const isScheduledTxn = isTxnScheduled(t);
  if (isScheduledTxn && !t.hasFixedScheduleDate) return true; // no-date always shown

  let txnDate: Date;
  try {
    txnDate = parseISO(t.date);
  } catch {
    return true;
  }

  const today = startOfDay(new Date());
  switch (filter.type) {
    case 'today':
      return isToday(txnDate);
    case 'yesterday':
      return isYesterday(txnDate);
    case 'this_week':
      return txnDate >= startOfWeek(today, { weekStartsOn: 1 }) && txnDate <= endOfWeek(today, { weekStartsOn: 1 });
    case 'this_month':
      return txnDate >= startOfMonth(today) && txnDate <= endOfMonth(today);
    case 'last_month': {
      const lm = subMonths(today, 1);
      return txnDate >= startOfMonth(lm) && txnDate <= endOfMonth(lm);
    }
    case 'custom':
      if (filter.from && filter.to) {
        const from = startOfDay(parseISO(filter.from));
        const to = endOfDay(parseISO(filter.to));
        return txnDate >= from && txnDate <= to;
      }
      return true;
    default:
      return true;
  }
}

// ── Main page ─────────────────────────────────────────────────────────────

type ActiveSheet =
  | null
  | 'date'
  | 'type'
  | 'account'
  | 'category'
  | 'payment'
  | 'status'
  | 'tags'
  | 'report';

export default function TransactionsPage() {
  const { transactions, load, remove, markCompleted } = useTransactionStore();
  const { accounts, load: loadAccounts } = useAccountStore();

  // ── Filter state ───────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>({ type: 'all' });
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [accountFilter, setAccountFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [paymentFilter, setPaymentFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [tagsFilter, setTagsFilter] = useState<string[]>([]);

  // ── UI state ───────────────────────────────────────────────────────────
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerType, setDrawerType] = useState<'income' | 'expense' | 'transfer'>('expense');
  const [editingTxn, setEditingTxn] = useState<Transaction | undefined>();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    load();
    loadAccounts();
  }, []);

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  // ── Filtered transactions ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matches =
          t.merchant?.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.notes?.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)) ||
          t.paymentMethod?.toLowerCase().includes(q) ||
          String(t.amountMinorUnits / 100).includes(q);
        if (!matches) return false;
      }
      // Type
      if (typeFilter.length > 0 && !typeFilter.includes(t.type)) return false;
      // Account
      if (accountFilter.length > 0 && !accountFilter.includes(t.accountId)) return false;
      // Category
      if (categoryFilter.length > 0 && !categoryFilter.includes(t.category)) return false;
      // Payment mode
      if (paymentFilter.length > 0 && !paymentFilter.includes(t.paymentMethod ?? '')) return false;
      // Status
      if (statusFilter.length > 0) {
        const scheduled = isTxnScheduled(t);
        const matchesStatus = statusFilter.includes(scheduled ? 'scheduled' : 'completed');
        if (!matchesStatus) return false;
      }
      // Tags
      if (tagsFilter.length > 0 && !tagsFilter.some((tag) => t.tags.includes(tag))) return false;
      // Date
      if (!applyDateFilter(t, dateFilter)) return false;
      return true;
    });
  }, [transactions, search, dateFilter, typeFilter, accountFilter, categoryFilter, paymentFilter, statusFilter, tagsFilter]);

  // ── Grouped by date ────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of filtered) {
      const key =
        isTxnScheduled(t) && !t.hasFixedScheduleDate
          ? 'no-date'
          : t.date.split('T')[0];
      const list = map.get(key) ?? [];
      list.push(t);
      map.set(key, list);
    }
    const entries = [...map.entries()];
    entries.sort(([a], [b]) => {
      if (a === 'no-date') return -1;
      if (b === 'no-date') return 1;
      return b.localeCompare(a);
    });
    return entries;
  }, [filtered]);

  // ── Summary ────────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const completed = filtered.filter((t) => !isTxnScheduled(t));
    const scheduled = filtered.filter((t) => isTxnScheduled(t));
    return {
      income: completed.filter((t) => t.type === 'income').reduce((s, t) => s + t.amountMinorUnits, 0),
      expense: completed.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amountMinorUnits, 0),
      scheduledIncome: scheduled.filter((t) => t.type === 'income').reduce((s, t) => s + t.amountMinorUnits, 0),
      scheduledExpense: scheduled.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amountMinorUnits, 0),
    };
  }, [filtered]);
  const net = summary.income - summary.expense;

  // ── All tags in current dataset ────────────────────────────────────────
  const allTags = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => t.tags.forEach((tag) => set.add(tag)));
    return [...set].sort();
  }, [transactions]);

  // ── Active filter count ────────────────────────────────────────────────
  const activeFilterCount =
    (dateFilter.type !== 'all' ? 1 : 0) +
    typeFilter.length +
    accountFilter.length +
    categoryFilter.length +
    paymentFilter.length +
    statusFilter.length +
    tagsFilter.length;

  // ── Handlers ──────────────────────────────────────────────────────────
  function openDrawer(type: 'income' | 'expense' | 'transfer' = 'expense', txn?: Transaction) {
    setDrawerType(type);
    setEditingTxn(txn);
    setDrawerOpen(true);
  }

  async function handleDelete(id: string) {
    await remove(id);
    setConfirmDeleteId(null);
    showToast('Transaction deleted');
  }

  async function handleMarkCompleted(id: string, type: Transaction['type']) {
    await markCompleted(id);
    const label =
      type === 'income' ? 'Received' : type === 'expense' ? 'Paid' : 'Transferred';
    showToast(`✓ Marked as ${label} today`);
  }

  function clearAllFilters() {
    setDateFilter({ type: 'all' });
    setTypeFilter([]);
    setAccountFilter([]);
    setCategoryFilter([]);
    setPaymentFilter([]);
    setStatusFilter([]);
    setTagsFilter([]);
    setSearch('');
    showToast('Filters cleared');
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* ── Sticky header ──────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100 shrink-0">
        {/* Title row */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Transactions</h1>
            <p className="text-xs text-slate-400">Log income, expenses &amp; transfers</p>
          </div>
          <div className="flex items-center gap-1">
            {/* Report icon */}
            <button
              onClick={() => setActiveSheet('report')}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              aria-label="Reports"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
            {/* Desktop add button */}
            <button
              onClick={() => openDrawer('expense')}
              className="hidden lg:flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="px-4 pb-3">
          <div className="relative">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search merchant, amount, category, notes..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-100 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white border border-transparent focus:border-transparent transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                aria-label="Clear search"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-none">
          {/* Filter icon chip */}
          <button
            onClick={() => activeFilterCount > 0 && clearAllFilters()}
            className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border transition-all ${
              activeFilterCount > 0
                ? 'bg-blue-100 text-blue-700 border-blue-200'
                : 'bg-white text-slate-500 border-slate-200'
            }`}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {activeFilterCount > 0 ? `${activeFilterCount} active · clear` : 'Filter'}
          </button>

          <FilterChip
            label={dateFilter.type === 'all' ? 'Date' : dateFilter.type.replace('_', ' ')}
            active={dateFilter.type !== 'all'}
            onClick={() => setActiveSheet('date')}
          />
          <FilterChip
            label={typeFilter.length > 0 ? typeFilter.join(', ') : 'Type'}
            active={typeFilter.length > 0}
            onClick={() => setActiveSheet('type')}
          />
          <FilterChip
            label={accountFilter.length > 0 ? `${accountFilter.length} account${accountFilter.length > 1 ? 's' : ''}` : 'Account'}
            active={accountFilter.length > 0}
            onClick={() => setActiveSheet('account')}
          />
          <FilterChip
            label={categoryFilter.length > 0 ? `${categoryFilter.length} categor${categoryFilter.length > 1 ? 'ies' : 'y'}` : 'Category'}
            active={categoryFilter.length > 0}
            onClick={() => setActiveSheet('category')}
          />
          <FilterChip
            label={paymentFilter.length > 0 ? `${paymentFilter.length} mode${paymentFilter.length > 1 ? 's' : ''}` : 'Payment'}
            active={paymentFilter.length > 0}
            onClick={() => setActiveSheet('payment')}
          />
          <FilterChip
            label={statusFilter.length > 0 ? statusFilter[0] : 'Status'}
            active={statusFilter.length > 0}
            onClick={() => setActiveSheet('status')}
          />
          <FilterChip
            label={tagsFilter.length > 0 ? `${tagsFilter.length} tag${tagsFilter.length > 1 ? 's' : ''}` : 'Tags'}
            active={tagsFilter.length > 0}
            onClick={() => setActiveSheet('tags')}
          />
        </div>
      </div>

      {/* ── Scrollable content ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-28">
        {/* Summary card */}
        <div className="pt-4">
          <SummaryCard
            income={summary.income}
            expense={summary.expense}
            net={net}
            scheduledIncome={summary.scheduledIncome}
            scheduledExpense={summary.scheduledExpense}
            count={filtered.length}
          />
        </div>

        {/* Transaction list */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <svg className="h-8 w-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-slate-700 font-semibold text-base mb-1">
              {transactions.length === 0 ? 'No transactions yet' : 'No matching transactions'}
            </p>
            <p className="text-slate-400 text-sm">
              {transactions.length === 0
                ? 'Tap + INCOME or − EXPENSE to log your first transaction'
                : 'Try adjusting your filters or search term'}
            </p>
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="px-4">
            {grouped.map(([dateKey, txns]) => (
              <div key={dateKey} className="mb-4">
                <DateGroupHeader dateKey={dateKey} />
                {txns.map((t) =>
                  isTxnScheduled(t) ? (
                    <ScheduledCard
                      key={t.id}
                      txn={t}
                      onMarkCompleted={() => handleMarkCompleted(t.id, t.type)}
                      onEdit={() => openDrawer(t.type, t)}
                      onDelete={() => setConfirmDeleteId(t.id)}
                    />
                  ) : (
                    <TxnCard
                      key={t.id}
                      txn={t}
                      onEdit={() => openDrawer(t.type, t)}
                      onDelete={() => setConfirmDeleteId(t.id)}
                    />
                  ),
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Fixed mobile bottom bar ─────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-100 px-4 py-3 lg:hidden safe-bottom">
        <div className="flex gap-3 max-w-lg mx-auto">
          <button
            onClick={() => openDrawer('income')}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-emerald-500 text-white font-bold text-sm rounded-2xl shadow-sm shadow-emerald-200 active:bg-emerald-600 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            INCOME
          </button>
          <button
            onClick={() => openDrawer('transfer')}
            className="w-12 flex items-center justify-center py-3.5 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 active:bg-blue-100 transition-colors shrink-0"
            aria-label="Transfer"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
          <button
            onClick={() => openDrawer('expense')}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-red-500 text-white font-bold text-sm rounded-2xl shadow-sm shadow-red-200 active:bg-red-600 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
            </svg>
            EXPENSE
          </button>
        </div>
      </div>

      {/* ── Transaction drawer ───────────────────────────────────────── */}
      <TransactionDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditingTxn(undefined); }}
        initialType={drawerType}
        initial={editingTxn}
        onSaved={() => showToast(editingTxn ? '✓ Transaction updated' : '✓ Transaction saved')}
      />

      {/* ── Filter sheets ────────────────────────────────────────────── */}
      <DateFilterSheet
        open={activeSheet === 'date'}
        onClose={() => setActiveSheet(null)}
        value={dateFilter}
        onChange={setDateFilter}
      />
      <TypeFilterSheet
        open={activeSheet === 'type'}
        onClose={() => setActiveSheet(null)}
        value={typeFilter}
        onChange={setTypeFilter}
      />
      <AccountFilterSheet
        open={activeSheet === 'account'}
        onClose={() => setActiveSheet(null)}
        value={accountFilter}
        onChange={setAccountFilter}
        accounts={accounts}
      />
      <CategoryFilterSheet
        open={activeSheet === 'category'}
        onClose={() => setActiveSheet(null)}
        value={categoryFilter}
        onChange={setCategoryFilter}
      />
      <PaymentModeFilterSheet
        open={activeSheet === 'payment'}
        onClose={() => setActiveSheet(null)}
        value={paymentFilter}
        onChange={setPaymentFilter}
      />
      <StatusFilterSheet
        open={activeSheet === 'status'}
        onClose={() => setActiveSheet(null)}
        value={statusFilter}
        onChange={setStatusFilter}
      />
      <TagsFilterSheet
        open={activeSheet === 'tags'}
        onClose={() => setActiveSheet(null)}
        value={tagsFilter}
        onChange={setTagsFilter}
        allTags={allTags}
      />

      {/* ── Report sheet ─────────────────────────────────────────────── */}
      <ReportSheet
        open={activeSheet === 'report'}
        onClose={() => setActiveSheet(null)}
        filteredTransactions={filtered}
        accounts={accounts}
        dateFilter={dateFilter}
        activeTypeFilters={typeFilter}
        activeCategoryFilters={categoryFilter}
      />

      {/* ── Delete confirm ───────────────────────────────────────────── */}
      <DeleteConfirm
        open={!!confirmDeleteId}
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />

      {/* ── Toast ────────────────────────────────────────────────────── */}
      {toast && <Toast msg={toast} />}
    </div>
  );
}
