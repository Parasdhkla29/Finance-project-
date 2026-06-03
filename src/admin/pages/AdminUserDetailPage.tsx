import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '../AdminLayout';
import { getUserDetail } from '../../admin/lib/adminApi';
import type { UserDetail } from '../../admin/lib/adminApi';

// ── CSV export helper ─────────────────────────────────────────────────────

function objectsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown): string => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ];
  return lines.join('\n');
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportTransactionsCsv(transactions: Record<string, unknown>[], username: string) {
  const rows = transactions.map((t) => ({
    date: (t as any).transaction_date ?? (t as any).date ?? '',
    type: (t as any).type ?? '',
    category: (t as any).category ?? '',
    merchant: (t as any).merchant ?? '',
    notes: (t as any).notes ?? '',
    amount: (((t as any).amount_minor_units ?? 0) / 100).toFixed(2),
    currency: (t as any).currency ?? '',
    status: (t as any).status ?? '',
  }));
  downloadBlob(objectsToCsv(rows), `transactions_${username}.csv`, 'text/csv');
}

// ── Icon helpers ──────────────────────────────────────────────────────────

function IconArrowLeft() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

// ── Badge components ──────────────────────────────────────────────────────

function RoleBadge({ role }: { role: 'admin' | 'user' }) {
  const cls =
    role === 'admin'
      ? 'bg-purple-100 text-purple-700 border border-purple-200'
      : 'bg-gray-100 text-gray-600 border border-gray-200';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {role === 'admin' ? 'Admin' : 'User'}
    </span>
  );
}

function StatusBadge({ status }: { status: 'active' | 'disabled' }) {
  const cls =
    status === 'active'
      ? 'bg-green-100 text-green-700 border border-green-200'
      : 'bg-red-100 text-red-700 border border-red-200';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {status === 'active' ? 'Active' : 'Disabled'}
    </span>
  );
}

function TxTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    income: 'bg-green-100 text-green-700',
    expense: 'bg-red-100 text-red-700',
    transfer: 'bg-blue-100 text-blue-700',
  };
  const cls = map[type?.toLowerCase()] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${cls}`}>
      {type ?? '—'}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === 'active' || status === 'completed'
      ? 'bg-green-100 text-green-700'
      : status === 'scheduled'
        ? 'bg-amber-100 text-amber-700'
        : status === 'disabled' || status === 'cancelled'
          ? 'bg-red-100 text-red-700'
          : 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${cls}`}>
      {status ?? '—'}
    </span>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
      Active
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
      Inactive
    </span>
  );
}

function AchievedBadge({ achieved }: { achieved: boolean }) {
  return achieved ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
      Achieved
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
      In Progress
    </span>
  );
}

// ── Formatting ────────────────────────────────────────────────────────────

function formatDate(raw: string | null | undefined): string {
  if (!raw) return '—';
  return new Date(raw).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatCurrency(minorUnits: number | null | undefined, currency = 'USD'): string {
  const amount = (minorUnits ?? 0) / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

// ── Tabs ──────────────────────────────────────────────────────────────────

type TabId =
  | 'transactions'
  | 'accounts'
  | 'loans'
  | 'subscriptions'
  | 'budgets'
  | 'goals'
  | 'credit_cards';

const TABS: { id: TabId; label: string }[] = [
  { id: 'transactions', label: 'Transactions' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'loans', label: 'Loans' },
  { id: 'subscriptions', label: 'Subscriptions' },
  { id: 'budgets', label: 'Budgets' },
  { id: 'goals', label: 'Goals' },
  { id: 'credit_cards', label: 'Credit Cards' },
];

// ── Pill filter button ────────────────────────────────────────────────────

function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className ?? ''}`} />;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <SkeletonBlock className="h-10 w-10 rounded-full" />
        <SkeletonBlock className="h-6 w-48" />
        <SkeletonBlock className="h-4 w-32" />
        <SkeletonBlock className="h-4 w-64" />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        {[...Array(5)].map((_, i) => (
          <SkeletonBlock key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-10 w-10 mb-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ── Table wrapper ─────────────────────────────────────────────────────────

function TableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">{children}</table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 whitespace-nowrap">
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`px-4 py-3 whitespace-nowrap text-gray-700 ${className ?? ''}`}>
      {children}
    </td>
  );
}

// ── Transactions tab ──────────────────────────────────────────────────────

type TxTypeFilter = 'all' | 'income' | 'expense' | 'transfer';
type TxStatusFilter = 'all' | 'completed' | 'scheduled';

function TransactionsTab({
  transactions,
  username,
}: {
  transactions: Record<string, unknown>[];
  username: string;
}) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TxTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<TxStatusFilter>('all');

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const row = t as any;
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        (row.merchant ?? '').toLowerCase().includes(q) ||
        (row.category ?? '').toLowerCase().includes(q) ||
        (row.notes ?? '').toLowerCase().includes(q);
      const matchType =
        typeFilter === 'all' || (row.type ?? '').toLowerCase() === typeFilter;
      const matchStatus =
        statusFilter === 'all' || (row.status ?? '').toLowerCase() === statusFilter;
      return matchSearch && matchType && matchStatus;
    });
  }, [transactions, search, typeFilter, statusFilter]);

  const TYPE_FILTERS: { id: TxTypeFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'income', label: 'Income' },
    { id: 'expense', label: 'Expense' },
    { id: 'transfer', label: 'Transfer' },
  ];

  const STATUS_FILTERS: { id: TxStatusFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'completed', label: 'Completed' },
    { id: 'scheduled', label: 'Scheduled' },
  ];

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          placeholder="Search merchant, category, notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-72 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={() => exportTransactionsCsv(filtered, username)}
          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export CSV
        </button>
      </div>

      {/* Type filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-500">Type:</span>
        {TYPE_FILTERS.map((f) => (
          <PillButton key={f.id} active={typeFilter === f.id} onClick={() => setTypeFilter(f.id)}>
            {f.label}
          </PillButton>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-500">Status:</span>
        {STATUS_FILTERS.map((f) => (
          <PillButton key={f.id} active={statusFilter === f.id} onClick={() => setStatusFilter(f.id)}>
            {f.label}
          </PillButton>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState message="No transactions found" />
      ) : (
        <TableWrapper>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Type</Th>
              <Th>Category</Th>
              <Th>Merchant</Th>
              <Th>Amount</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filtered.map((t, i) => {
              const row = t as any;
              const type = (row.type ?? '').toLowerCase();
              const amountColor =
                type === 'income'
                  ? 'text-green-600 font-semibold'
                  : type === 'expense'
                    ? 'text-red-600 font-semibold'
                    : 'text-gray-700';
              return (
                <tr key={row.id ?? i} className="hover:bg-gray-50">
                  <Td>{formatDate(row.transaction_date ?? row.date)}</Td>
                  <Td><TxTypeBadge type={row.type} /></Td>
                  <Td>{row.category ?? '—'}</Td>
                  <Td>{row.merchant ?? '—'}</Td>
                  <Td className={amountColor}>
                    {type === 'expense' ? '−' : ''}
                    {formatCurrency(row.amount_minor_units, row.currency)}
                  </Td>
                  <Td><StatusPill status={row.status} /></Td>
                </tr>
              );
            })}
          </tbody>
        </TableWrapper>
      )}
    </div>
  );
}

// ── Accounts tab ──────────────────────────────────────────────────────────

const ACCOUNT_BORDER_COLORS = [
  'border-blue-400',
  'border-emerald-400',
  'border-violet-400',
  'border-amber-400',
  'border-rose-400',
  'border-cyan-400',
];

function AccountsTab({ accounts }: { accounts: Record<string, unknown>[] }) {
  if (accounts.length === 0) return <EmptyState message="No accounts found" />;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {accounts.map((a, i) => {
        const row = a as any;
        const borderColor = ACCOUNT_BORDER_COLORS[i % ACCOUNT_BORDER_COLORS.length];
        return (
          <div
            key={row.id ?? i}
            className={`bg-white rounded-xl border border-gray-200 border-l-4 ${borderColor} p-5 space-y-2 shadow-sm`}
          >
            <p className="font-semibold text-gray-900 text-sm truncate">
              {row.account_name ?? 'Unnamed Account'}
            </p>
            <p className="text-xs text-gray-500 capitalize">{row.type ?? row.account_type ?? '—'}</p>
            {row.currency && (
              <p className="text-xs text-gray-400">{row.currency}</p>
            )}
            {row.balance_minor_units != null && (
              <p className="text-base font-bold text-gray-800">
                {formatCurrency(row.balance_minor_units, row.currency)}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Loans tab ─────────────────────────────────────────────────────────────

function LoansTab({ loans }: { loans: Record<string, unknown>[] }) {
  if (loans.length === 0) return <EmptyState message="No loans found" />;
  return (
    <TableWrapper>
      <thead>
        <tr>
          <Th>Counterparty</Th>
          <Th>Direction</Th>
          <Th>Principal</Th>
          <Th>Remaining</Th>
          <Th>Status</Th>
          <Th>Due Date</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 bg-white">
        {loans.map((l, i) => {
          const row = l as any;
          return (
            <tr key={row.id ?? i} className="hover:bg-gray-50">
              <Td>{row.counterparty ?? '—'}</Td>
              <Td>
                <span className={`capitalize text-xs font-semibold ${row.direction === 'lent' ? 'text-blue-600' : 'text-orange-600'}`}>
                  {row.direction ?? '—'}
                </span>
              </Td>
              <Td>{formatCurrency(row.principal_minor_units, row.currency)}</Td>
              <Td>{formatCurrency(row.remaining_minor_units, row.currency)}</Td>
              <Td><StatusPill status={row.status} /></Td>
              <Td>{formatDate(row.due_date)}</Td>
            </tr>
          );
        })}
      </tbody>
    </TableWrapper>
  );
}

// ── Subscriptions tab ─────────────────────────────────────────────────────

function SubscriptionsTab({ subscriptions }: { subscriptions: Record<string, unknown>[] }) {
  if (subscriptions.length === 0) return <EmptyState message="No subscriptions found" />;
  return (
    <div className="space-y-3">
      {subscriptions.map((s, i) => {
        const row = s as any;
        return (
          <div
            key={row.id ?? i}
            className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-5 py-4 shadow-sm"
          >
            <div className="space-y-0.5">
              <p className="font-semibold text-gray-900 text-sm">{row.name ?? '—'}</p>
              <p className="text-xs text-gray-500 capitalize">
                {row.billing_cycle ?? '—'}
                {row.next_billing_date ? ` · Next: ${formatDate(row.next_billing_date)}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <p className="font-bold text-gray-800 text-sm">
                {formatCurrency(row.amount_minor_units, row.currency)}
              </p>
              <StatusPill status={row.status} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Budgets tab ───────────────────────────────────────────────────────────

function BudgetsTab({ budgets }: { budgets: Record<string, unknown>[] }) {
  if (budgets.length === 0) return <EmptyState message="No budgets found" />;
  return (
    <div className="space-y-3">
      {budgets.map((b, i) => {
        const row = b as any;
        return (
          <div
            key={row.id ?? i}
            className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-5 py-4 shadow-sm"
          >
            <div className="space-y-0.5">
              <p className="font-semibold text-gray-900 text-sm">{row.name ?? '—'}</p>
              <p className="text-xs text-gray-500 capitalize">
                {row.category ?? '—'}
                {row.period ? ` · ${row.period}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <p className="font-bold text-gray-800 text-sm">
                {formatCurrency(row.amount_minor_units, row.currency)}
              </p>
              <ActiveBadge active={Boolean(row.is_active ?? row.active)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Goals tab ─────────────────────────────────────────────────────────────

function GoalsTab({ goals }: { goals: Record<string, unknown>[] }) {
  if (goals.length === 0) return <EmptyState message="No goals found" />;
  return (
    <div className="space-y-4">
      {goals.map((g, i) => {
        const row = g as any;
        const target = row.target_amount_minor_units ?? row.target_minor_units ?? 0;
        const current = row.current_amount_minor_units ?? row.current_minor_units ?? 0;
        const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
        return (
          <div
            key={row.id ?? i}
            className="bg-white rounded-xl border border-gray-200 px-5 py-4 space-y-3 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900 text-sm">{row.name ?? '—'}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatCurrency(current, row.currency)} of {formatCurrency(target, row.currency)}
                </p>
              </div>
              <AchievedBadge achieved={Boolean(row.is_achieved ?? row.achieved)} />
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${pct}%` }}
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <p className="text-xs text-gray-400 text-right">{pct}%</p>
          </div>
        );
      })}
    </div>
  );
}

// ── Credit Cards tab ──────────────────────────────────────────────────────

function CreditCardsTab({ creditCards }: { creditCards: Record<string, unknown>[] }) {
  if (creditCards.length === 0) return <EmptyState message="No credit cards found" />;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {creditCards.map((c, i) => {
        const row = c as any;
        return (
          <div
            key={row.id ?? i}
            className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 text-white shadow-md space-y-4"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-semibold opacity-80">{row.card_name ?? row.name ?? 'Card'}</p>
                <p className="text-lg font-bold mt-1 tracking-widest">
                  •••• {row.last4 ?? row.last_four ?? '——'}
                </p>
              </div>
              <span className="text-xs font-bold uppercase opacity-70 bg-white/10 px-2 py-1 rounded">
                {row.network ?? '—'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="opacity-60 uppercase tracking-wide">Limit</p>
                <p className="font-semibold mt-0.5">
                  {formatCurrency(row.credit_limit_minor_units ?? row.limit_minor_units, row.currency)}
                </p>
              </div>
              <div>
                <p className="opacity-60 uppercase tracking-wide">Balance</p>
                <p className="font-semibold mt-0.5">
                  {formatCurrency(row.balance_minor_units, row.currency)}
                </p>
              </div>
              <div>
                <p className="opacity-60 uppercase tracking-wide">Status</p>
                <p className="font-semibold capitalize mt-0.5">{row.status ?? '—'}</p>
              </div>
              <div>
                <p className="opacity-60 uppercase tracking-wide">Due Date</p>
                <p className="font-semibold mt-0.5">{formatDate(row.due_date ?? row.payment_due_date)}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function AdminUserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('transactions');

  useEffect(() => {
    if (!userId) {
      setError('No user ID provided');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    getUserDetail(userId)
      .then((d) => {
        setDetail(d);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'User not found');
        setLoading(false);
      });
  }, [userId]);

  const user = detail?.user;

  const avatarInitial = user?.username?.charAt(0).toUpperCase() ?? '?';

  const AVATAR_COLORS = [
    'bg-blue-500',
    'bg-emerald-500',
    'bg-violet-500',
    'bg-amber-500',
    'bg-rose-500',
  ];
  const avatarColor =
    AVATAR_COLORS[(avatarInitial.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];

  return (
    <AdminLayout>
      {loading && <LoadingSkeleton />}

      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <p className="text-lg font-semibold text-gray-700">User not found</p>
          <p className="text-sm text-gray-500">{error}</p>
          <button
            type="button"
            onClick={() => navigate('/admin/users')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <IconArrowLeft />
            Back to Users
          </button>
        </div>
      )}

      {!loading && !error && user && detail && (
        <div className="space-y-6 max-w-6xl mx-auto">
          {/* Header card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            {/* Back button */}
            <button
              type="button"
              onClick={() => navigate('/admin/users')}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors"
            >
              <IconArrowLeft />
              Users
            </button>

            <div className="flex flex-col sm:flex-row sm:items-start gap-5">
              {/* Avatar */}
              <div
                className={`w-16 h-16 rounded-full ${avatarColor} flex items-center justify-center shrink-0`}
                aria-hidden="true"
              >
                <span className="text-2xl font-bold text-white">{avatarInitial}</span>
              </div>

              {/* User info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold text-gray-900 truncate">{user.fullName}</h2>
                  <RoleBadge role={user.role} />
                  <StatusBadge status={user.status} />
                  {user.tempPasswordRequired && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                      Temp Password Required
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mb-3">@{user.username}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 text-sm">
                  {user.email && (
                    <div>
                      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide block">Email</span>
                      <span className="text-gray-700">{user.email}</span>
                    </div>
                  )}
                  {user.phone && (
                    <div>
                      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide block">Phone</span>
                      <span className="text-gray-700">{user.phone}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wide block">Created</span>
                    <span className="text-gray-700">{formatDate(user.createdAt)}</span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wide block">Last Login</span>
                    <span className="text-gray-700">{formatDate(user.lastLoginAt)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Tab bar */}
            <div className="border-b border-gray-200 overflow-x-auto">
              <nav className="flex min-w-max" aria-label="User detail tabs">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                    aria-current={activeTab === tab.id ? 'page' : undefined}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab content */}
            <div className="p-6">
              {activeTab === 'transactions' && (
                <TransactionsTab transactions={detail.transactions} username={user.username} />
              )}
              {activeTab === 'accounts' && <AccountsTab accounts={detail.accounts} />}
              {activeTab === 'loans' && <LoansTab loans={detail.loans} />}
              {activeTab === 'subscriptions' && (
                <SubscriptionsTab subscriptions={detail.subscriptions} />
              )}
              {activeTab === 'budgets' && <BudgetsTab budgets={detail.budgets} />}
              {activeTab === 'goals' && <GoalsTab goals={detail.goals} />}
              {activeTab === 'credit_cards' && (
                <CreditCardsTab creditCards={detail.creditCards} />
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
