import { useMemo, useState, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import BottomSheet from '../ui/BottomSheet';
import type { Transaction, Account } from '../../core/types';
import { formatCurrency, isScheduled } from '../../core/types';
import { format, parseISO } from 'date-fns';
import { CATEGORY_EMOJIS } from './CategorySheet';
import { PAYMENT_MODE_LABELS } from './FilterSheets';
import type { DateFilter } from './FilterSheets';
import { useAuthStore } from '../../auth/useAuthStore';

// ── Helpers ────────────────────────────────────────────────────────────────

function sumAmount(txns: Transaction[]): number {
  return txns.reduce((s, t) => s + t.amountMinorUnits, 0);
}

function fmt(minor: number): string {
  return formatCurrency(minor, 'GBP');
}

function fmtDate(iso: string): string {
  try {
    return format(parseISO(iso.split('T')[0]), 'dd/MM/yyyy');
  } catch {
    return iso.split('T')[0];
  }
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 mt-4">
      {children}
    </h3>
  );
}

function StatRow({
  label,
  value,
  color = 'text-slate-800',
  sub,
}: {
  label: string;
  value: string;
  color?: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
      <div>
        <p className="text-sm text-slate-700 font-medium">{label}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
    </div>
  );
}

// ── Report types ─────────────────────────────────────────────────────────

type ReportType = 'all' | 'daily' | 'category' | 'payment' | 'account' | 'scheduled';

const REPORT_OPTIONS: { id: ReportType; label: string; desc: string }[] = [
  { id: 'all', label: 'All Transactions', desc: 'Full list with all details' },
  { id: 'daily', label: 'Day-wise Summary', desc: 'Income, expense & net per day' },
  { id: 'category', label: 'Category Summary', desc: 'Spend by category' },
  { id: 'payment', label: 'Payment Mode', desc: 'Totals by payment method' },
  { id: 'account', label: 'Account Summary', desc: 'Balance movement per account' },
  { id: 'scheduled', label: 'Scheduled / Pending', desc: 'All pending payments' },
];

// ── Filter summary label ──────────────────────────────────────────────────

function filterLabel(dateFilter: DateFilter): string {
  if (dateFilter.type === 'all') return 'All Time';
  if (dateFilter.type === 'today') return 'Today';
  if (dateFilter.type === 'yesterday') return 'Yesterday';
  if (dateFilter.type === 'this_week') return 'This Week';
  if (dateFilter.type === 'this_month') return 'This Month';
  if (dateFilter.type === 'last_month') return 'Last Month';
  if (dateFilter.type === 'custom' && dateFilter.from && dateFilter.to) {
    return `${dateFilter.from} → ${dateFilter.to}`;
  }
  return 'Custom';
}

// ── Download helpers ──────────────────────────────────────────────────────

function downloadCSV(rows: Record<string, string | number>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map((r) =>
      headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','),
    ),
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Print Report (portal rendered to document.body) ───────────────────────

interface PrintReportProps {
  transactions: Transaction[];
  totalIncome: number;
  totalExpense: number;
  dateFilter: DateFilter;
  userName: string;
  userHandle: string;
}

function PrintReport({
  transactions,
  totalIncome,
  totalExpense,
  dateFilter,
  userName,
  userHandle,
}: PrintReportProps) {
  const finalBalance = totalIncome - totalExpense;
  const now = new Date();
  const generatedOn = format(now, 'dd/MM/yyyy HH:mm');

  // Sort ascending by date for running balance
  const rows = useMemo(() => {
    let balance = 0;
    return transactions
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((t) => {
        const isIncome = t.type === 'income';
        const isExpense = t.type === 'expense';
        if (isIncome) balance += t.amountMinorUnits;
        else if (isExpense) balance -= t.amountMinorUnits;
        return { txn: t, runningBalance: balance };
      });
  }, [transactions]);

  // Duration display
  const durationLabel = useMemo(() => {
    if (dateFilter.type === 'custom' && dateFilter.from && dateFilter.to) {
      return `${fmtDate(dateFilter.from)} - ${fmtDate(dateFilter.to)}`;
    }
    if (transactions.length === 0) return filterLabel(dateFilter);
    const dates = transactions.map((t) => t.date.split('T')[0]).sort();
    const from = fmtDate(dates[0]);
    const to = fmtDate(dates[dates.length - 1]);
    return from === to ? from : `${from} - ${to}`;
  }, [dateFilter, transactions]);

  return createPortal(
    <div id="finance-print-report">
      <style>{`
        @media screen { #finance-print-report { display: none !important; } }
        @media print {
          @page { margin: 12mm 10mm; size: A4 portrait; }
          body > *:not(#finance-print-report) { display: none !important; visibility: hidden !important; }
          #finance-print-report {
            display: block !important;
            visibility: visible !important;
            position: fixed !important;
            inset: 0 !important;
            background: white !important;
            z-index: 999999 !important;
            font-family: Arial, sans-serif;
            font-size: 11px;
            color: #111;
          }
          #finance-print-report * { visibility: visible !important; box-sizing: border-box; }
          .pr-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 10px; border-bottom: 2px solid #111; margin-bottom: 10px; }
          .pr-logo { display: flex; align-items: center; gap: 10px; }
          .pr-logo-icon { width: 40px; height: 40px; border-radius: 10px; background: #1d4ed8; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 18px; }
          .pr-title { font-size: 20px; font-weight: bold; color: #111; }
          .pr-meta { text-align: right; font-size: 10px; color: #444; line-height: 1.6; }
          .pr-business { font-size: 16px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 3px; }
          .pr-duration { font-size: 11px; color: #555; margin-bottom: 10px; }
          .pr-summary { display: flex; gap: 8px; margin-bottom: 10px; }
          .pr-summary-box { flex: 1; padding: 8px 10px; border-radius: 6px; }
          .pr-summary-box.green { background: #d1fae5; border: 1px solid #6ee7b7; }
          .pr-summary-box.red { background: #fee2e2; border: 1px solid #fca5a5; }
          .pr-summary-box.blue { background: #dbeafe; border: 1px solid #93c5fd; }
          .pr-summary-label { font-size: 9px; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; }
          .pr-summary-box.green .pr-summary-label { color: #065f46; }
          .pr-summary-box.red .pr-summary-label { color: #991b1b; }
          .pr-summary-box.blue .pr-summary-label { color: #1e3a8a; }
          .pr-summary-value { font-size: 13px; font-weight: bold; }
          .pr-summary-box.green .pr-summary-value { color: #047857; }
          .pr-summary-box.red .pr-summary-value { color: #b91c1c; }
          .pr-summary-box.blue .pr-summary-value { color: #1d4ed8; }
          .pr-entries-count { font-size: 10px; color: #555; margin-bottom: 8px; }
          .pr-table { width: 100%; border-collapse: collapse; font-size: 10px; }
          .pr-table th { background: #1d4ed8; color: white; padding: 5px 6px; text-align: left; font-weight: bold; }
          .pr-table th.right, .pr-table td.right { text-align: right; }
          .pr-table td { padding: 4px 6px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
          .pr-table tr:nth-child(even) td { background: #f8fafc; }
          .pr-table tr.final-row td { border-top: 2px solid #111; font-weight: bold; background: #f1f5f9; }
          .pr-table td.income { color: #047857; font-weight: 600; }
          .pr-table td.expense { color: #b91c1c; font-weight: 600; }
          .pr-table td.balance-pos { color: #1d4ed8; font-weight: 700; }
          .pr-table td.balance-neg { color: #b91c1c; font-weight: 700; }
          .pr-footer { margin-top: 12px; font-size: 9px; color: #888; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 6px; }
        }
      `}</style>

      {/* Header */}
      <div className="pr-header">
        <div className="pr-logo">
          <div className="pr-logo-icon">₹</div>
          <div>
            <div className="pr-title">Finance Report</div>
          </div>
        </div>
        <div className="pr-meta">
          <div>Generated on: {generatedOn}</div>
          <div>Generated by: {userName} ({userHandle})</div>
        </div>
      </div>

      {/* Business name + duration */}
      <div className="pr-business">{userName}</div>
      <div className="pr-duration">Duration: {durationLabel}</div>

      {/* Summary boxes */}
      <div className="pr-summary">
        <div className="pr-summary-box green">
          <div className="pr-summary-label">Total Cash In</div>
          <div className="pr-summary-value">{fmt(totalIncome)}</div>
        </div>
        <div className="pr-summary-box red">
          <div className="pr-summary-label">Total Cash Out</div>
          <div className="pr-summary-value">{fmt(totalExpense)}</div>
        </div>
        <div className="pr-summary-box blue">
          <div className="pr-summary-label">Final Balance</div>
          <div className="pr-summary-value">{fmt(finalBalance)}</div>
        </div>
      </div>

      <div className="pr-entries-count">Total No. of entries: {transactions.length}</div>

      {/* Entries table */}
      <table className="pr-table">
        <thead>
          <tr>
            <th style={{ width: '70px' }}>Date</th>
            <th>Remark</th>
            <th style={{ width: '90px' }}>Category</th>
            <th style={{ width: '70px' }}>Mode</th>
            <th className="right" style={{ width: '80px' }}>Cash In</th>
            <th className="right" style={{ width: '80px' }}>Cash Out</th>
            <th className="right" style={{ width: '80px' }}>Balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ txn, runningBalance }) => {
            const isIncome = txn.type === 'income';
            const isExpense = txn.type === 'expense';
            const balClass = runningBalance >= 0 ? 'balance-pos' : 'balance-neg';
            return (
              <tr key={txn.id}>
                <td>{fmtDate(txn.date)}</td>
                <td>{txn.notes ?? txn.merchant ?? txn.category}</td>
                <td>
                  {CATEGORY_EMOJIS[txn.category] ? `${CATEGORY_EMOJIS[txn.category]} ` : ''}
                  {txn.category}
                </td>
                <td>{PAYMENT_MODE_LABELS[txn.paymentMethod ?? ''] ?? txn.paymentMethod ?? '—'}</td>
                <td className={`right${isIncome ? ' income' : ''}`}>
                  {isIncome ? fmt(txn.amountMinorUnits) : ''}
                </td>
                <td className={`right${isExpense ? ' expense' : ''}`}>
                  {isExpense ? fmt(txn.amountMinorUnits) : ''}
                </td>
                <td className={`right ${balClass}`}>{fmt(runningBalance)}</td>
              </tr>
            );
          })}
          {/* Final balance row */}
          <tr className="final-row">
            <td colSpan={6} style={{ textAlign: 'right', paddingRight: '8px' }}>
              Final Balance
            </td>
            <td className={`right ${finalBalance >= 0 ? 'balance-pos' : 'balance-neg'}`}>
              {fmt(finalBalance)}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="pr-footer">
        This report was automatically generated · {generatedOn}
      </div>
    </div>,
    document.body,
  );
}

// ── Main component ────────────────────────────────────────────────────────

interface ReportSheetProps {
  open: boolean;
  onClose: () => void;
  filteredTransactions: Transaction[];
  accounts: Account[];
  dateFilter: DateFilter;
  activeTypeFilters: string[];
  activeCategoryFilters: string[];
}

export default function ReportSheet({
  open,
  onClose,
  filteredTransactions,
  accounts,
  dateFilter,
}: ReportSheetProps) {
  const [reportType, setReportType] = useState<ReportType>('all');
  const user = useAuthStore((s) => s.user);

  // Inject print CSS that hides the app shell
  useEffect(() => {
    const styleId = 'finance-print-css';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @media print {
        body > *:not(#finance-print-report) { display: none !important; }
        #finance-print-report { display: block !important; }
      }
    `;
    document.head.appendChild(style);
  }, []);

  const completed = filteredTransactions.filter((t) => !isScheduled(t));
  const scheduled = filteredTransactions.filter((t) => isScheduled(t));

  const totalIncome = sumAmount(completed.filter((t) => t.type === 'income'));
  const totalExpense = sumAmount(completed.filter((t) => t.type === 'expense'));
  const totalScheduledIncome = sumAmount(scheduled.filter((t) => t.type === 'income'));
  const totalScheduledExpense = sumAmount(scheduled.filter((t) => t.type === 'expense'));

  // ── Day-wise data ─────────────────────────────────────────────────────
  const dailySummary = useMemo(() => {
    const map = new Map<string, { income: number; expense: number; transfer: number }>();
    for (const t of completed) {
      const day = t.date.split('T')[0];
      const entry = map.get(day) ?? { income: 0, expense: 0, transfer: 0 };
      if (t.type === 'income') entry.income += t.amountMinorUnits;
      else if (t.type === 'expense') entry.expense += t.amountMinorUnits;
      else entry.transfer += t.amountMinorUnits;
      map.set(day, entry);
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [completed]);

  // ── Category data ─────────────────────────────────────────────────────
  const categorySummary = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of completed.filter((tx) => tx.type === 'expense')) {
      map.set(t.category, (map.get(t.category) ?? 0) + t.amountMinorUnits);
    }
    return [...map.entries()].sort(([, a], [, b]) => b - a);
  }, [completed]);

  // ── Payment mode data ─────────────────────────────────────────────────
  const paymentSummary = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of completed) {
      const pm = t.paymentMethod ?? 'unknown';
      map.set(pm, (map.get(pm) ?? 0) + t.amountMinorUnits);
    }
    return [...map.entries()].sort(([, a], [, b]) => b - a);
  }, [completed]);

  // ── Account data ──────────────────────────────────────────────────────
  const accountSummary = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    for (const acc of accounts) {
      map.set(acc.id, { income: 0, expense: 0 });
    }
    for (const t of completed) {
      const entry = map.get(t.accountId);
      if (!entry) continue;
      if (t.type === 'income') entry.income += t.amountMinorUnits;
      else if (t.type === 'expense') entry.expense += t.amountMinorUnits;
    }
    return [...map.entries()].filter(([, v]) => v.income > 0 || v.expense > 0);
  }, [completed, accounts]);

  function handleExportCSV() {
    if (reportType === 'all') {
      downloadCSV(
        filteredTransactions.map((t) => ({
          date: t.date.split('T')[0],
          type: t.type,
          merchant: t.merchant ?? '',
          category: t.category,
          amount: (t.amountMinorUnits / 100).toFixed(2),
          currency: t.currency,
          paymentMethod: t.paymentMethod ?? '',
          status: isScheduled(t) ? 'scheduled' : 'completed',
          notes: t.notes ?? '',
          tags: t.tags.join(';'),
        })),
        `transactions-${new Date().toISOString().split('T')[0]}.csv`,
      );
    } else if (reportType === 'daily') {
      downloadCSV(
        dailySummary.map(([day, d]) => ({
          date: day,
          income: (d.income / 100).toFixed(2),
          expense: (d.expense / 100).toFixed(2),
          net: ((d.income - d.expense) / 100).toFixed(2),
        })),
        `daily-summary-${new Date().toISOString().split('T')[0]}.csv`,
      );
    } else if (reportType === 'category') {
      downloadCSV(
        categorySummary.map(([cat, amt]) => ({
          category: cat,
          total_expense: (amt / 100).toFixed(2),
        })),
        `category-summary-${new Date().toISOString().split('T')[0]}.csv`,
      );
    }
  }

  const currentReportData = useMemo(() => {
    switch (reportType) {
      case 'all':
        return filteredTransactions;
      case 'scheduled':
        return scheduled;
      default:
        return [];
    }
  }, [reportType, filteredTransactions, scheduled]);

  function handlePrint() {
    window.print();
  }

  return (
    <>
      {/* Portal-rendered print layout (hidden on screen, shown during print) */}
      <PrintReport
        transactions={completed}
        totalIncome={totalIncome}
        totalExpense={totalExpense}
        dateFilter={dateFilter}
        userName={user?.fullName ?? 'User'}
        userHandle={user?.username ?? ''}
      />

      <BottomSheet open={open} onClose={onClose} title="Generate Report" fullScreen>
        <div className="px-4 pb-6">
          {/* Filter summary */}
          <div className="mt-3 p-3 bg-slate-50 rounded-xl flex flex-wrap gap-2">
            <span className="text-xs font-medium text-slate-500 bg-white px-2.5 py-1 rounded-full border border-slate-200">
              📅 {filterLabel(dateFilter)}
            </span>
            <span className="text-xs font-medium text-slate-500 bg-white px-2.5 py-1 rounded-full border border-slate-200">
              {filteredTransactions.length} transactions
            </span>
          </div>

          {/* Overall summary */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-emerald-50 rounded-xl p-3">
              <p className="text-xs text-emerald-600 font-semibold">Total Income</p>
              <p className="text-lg font-bold text-emerald-700 mt-0.5">{fmt(totalIncome)}</p>
            </div>
            <div className="bg-red-50 rounded-xl p-3">
              <p className="text-xs text-red-600 font-semibold">Total Expense</p>
              <p className="text-lg font-bold text-red-700 mt-0.5">{fmt(totalExpense)}</p>
            </div>
            <div className={`rounded-xl p-3 col-span-2 ${totalIncome - totalExpense >= 0 ? 'bg-blue-50' : 'bg-red-50'}`}>
              <p className="text-xs font-semibold text-slate-600">Net Balance</p>
              <p className={`text-xl font-bold mt-0.5 ${totalIncome - totalExpense >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                {totalIncome - totalExpense >= 0 ? '+' : ''}{fmt(totalIncome - totalExpense)}
              </p>
            </div>
          </div>

          {/* Report type selector */}
          <SectionTitle>Report Type</SectionTitle>
          <div className="space-y-1.5">
            {REPORT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setReportType(opt.id)}
                className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                  reportType === opt.id
                    ? 'bg-blue-50 border-blue-200'
                    : 'border-slate-100 hover:bg-slate-50'
                }`}
              >
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${reportType === opt.id ? 'text-blue-700' : 'text-slate-800'}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
                </div>
                {reportType === opt.id && (
                  <svg className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* ── Report content ──────────────────────────────────────── */}

          {reportType === 'all' && (
            <>
              <SectionTitle>All Transactions ({currentReportData.length})</SectionTitle>
              <div className="space-y-2">
                {(currentReportData as Transaction[]).slice(0, 50).map((t) => (
                  <div key={t.id} className="flex items-center gap-3 py-2.5 border-b border-slate-50">
                    <div
                      className={`w-1 h-10 rounded-full shrink-0 ${
                        isScheduled(t) ? 'bg-purple-400' : t.type === 'income' ? 'bg-emerald-500' : t.type === 'expense' ? 'bg-red-500' : 'bg-blue-500'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {t.merchant ?? t.category}
                      </p>
                      <p className="text-xs text-slate-400">
                        {isScheduled(t) ? 'Scheduled' : t.date.split('T')[0]} · {t.category}
                      </p>
                    </div>
                    <p className={`text-sm font-bold shrink-0 ${
                      isScheduled(t) ? 'text-purple-600' : t.type === 'income' ? 'text-emerald-600' : t.type === 'expense' ? 'text-red-600' : 'text-blue-600'
                    }`}>
                      {t.type === 'income' ? '+' : '-'}{fmt(t.amountMinorUnits)}
                    </p>
                  </div>
                ))}
                {currentReportData.length > 50 && (
                  <p className="text-xs text-slate-400 text-center pt-2">
                    Showing first 50 of {currentReportData.length} — export for full list
                  </p>
                )}
              </div>
            </>
          )}

          {reportType === 'daily' && (
            <>
              <SectionTitle>Day-wise Summary ({dailySummary.length} days)</SectionTitle>
              <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                {dailySummary.map(([day, data]) => (
                  <div key={day} className="px-4 py-3 border-b border-slate-50 last:border-0">
                    <p className="text-xs font-bold text-slate-500 mb-1.5">
                      {format(parseISO(day), 'd MMM yyyy')}
                    </p>
                    <div className="flex gap-4">
                      <span className="text-xs text-emerald-600 font-semibold">+{fmt(data.income)}</span>
                      <span className="text-xs text-red-600 font-semibold">-{fmt(data.expense)}</span>
                      <span className={`text-xs font-bold ml-auto ${data.income - data.expense >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        Net: {data.income - data.expense >= 0 ? '+' : ''}{fmt(data.income - data.expense)}
                      </span>
                    </div>
                  </div>
                ))}
                {dailySummary.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-6">No data</p>
                )}
              </div>
            </>
          )}

          {reportType === 'category' && (
            <>
              <SectionTitle>Category Summary (Expenses)</SectionTitle>
              <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                {categorySummary.map(([cat, amt]) => (
                  <div key={cat} className="flex items-center gap-3 px-4 py-3 border-b border-slate-50 last:border-0">
                    <span className="text-lg w-7 text-center shrink-0">{CATEGORY_EMOJIS[cat] ?? '📌'}</span>
                    <span className="flex-1 text-sm font-medium text-slate-700">{cat}</span>
                    <span className="text-sm font-bold text-red-600">{fmt(amt)}</span>
                  </div>
                ))}
                {categorySummary.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-6">No expense data</p>
                )}
              </div>
            </>
          )}

          {reportType === 'payment' && (
            <>
              <SectionTitle>Payment Mode Summary</SectionTitle>
              <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                {paymentSummary.map(([pm, amt]) => (
                  <StatRow
                    key={pm}
                    label={PAYMENT_MODE_LABELS[pm] ?? pm}
                    value={fmt(amt)}
                  />
                ))}
                {paymentSummary.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-6">No data</p>
                )}
              </div>
            </>
          )}

          {reportType === 'account' && (
            <>
              <SectionTitle>Account Summary</SectionTitle>
              <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                {accountSummary.map(([accId, data]) => {
                  const acc = accounts.find((a) => a.id === accId);
                  if (!acc) return null;
                  return (
                    <div key={accId} className="px-4 py-3 border-b border-slate-50 last:border-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: acc.color }} />
                        <span className="text-sm font-semibold text-slate-800">{acc.name}</span>
                      </div>
                      <div className="flex gap-4">
                        <span className="text-xs text-emerald-600 font-semibold">In: +{fmt(data.income)}</span>
                        <span className="text-xs text-red-600 font-semibold">Out: -{fmt(data.expense)}</span>
                        <span className={`text-xs font-bold ml-auto ${data.income - data.expense >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                          Net: {data.income - data.expense >= 0 ? '+' : ''}{fmt(data.income - data.expense)}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {accountSummary.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-6">No data</p>
                )}
              </div>
            </>
          )}

          {reportType === 'scheduled' && (
            <>
              <SectionTitle>Scheduled / Pending ({scheduled.length})</SectionTitle>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-emerald-50 rounded-xl p-3">
                  <p className="text-xs text-emerald-600 font-semibold">Expected Income</p>
                  <p className="text-base font-bold text-emerald-700 mt-0.5">{fmt(totalScheduledIncome)}</p>
                </div>
                <div className="bg-red-50 rounded-xl p-3">
                  <p className="text-xs text-red-600 font-semibold">Expected Expense</p>
                  <p className="text-base font-bold text-red-700 mt-0.5">{fmt(totalScheduledExpense)}</p>
                </div>
              </div>
              <div className="space-y-2">
                {scheduled.map((t) => (
                  <div key={t.id} className="bg-purple-50 rounded-xl p-3 border border-purple-100">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{t.merchant ?? t.category}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {t.hasFixedScheduleDate
                            ? `Expected: ${t.date.split('T')[0]}`
                            : 'No fixed date'}
                        </p>
                      </div>
                      <p className={`text-sm font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {t.type === 'income' ? '+' : '-'}{fmt(t.amountMinorUnits)}
                      </p>
                    </div>
                  </div>
                ))}
                {scheduled.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-6">No scheduled payments</p>
                )}
              </div>
            </>
          )}

          {/* Export buttons */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={handleExportCSV}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 border-emerald-200 text-emerald-700 font-semibold text-sm hover:bg-emerald-50 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 border-blue-200 text-blue-700 font-semibold text-sm hover:bg-blue-50 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print / PDF
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
