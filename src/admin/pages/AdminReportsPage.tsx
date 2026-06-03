import { useState, useEffect } from 'react';
import AdminLayout from '../AdminLayout';
import {
  getUsers,
  getActivityLogs,
  getDashboardStats,
} from '../../admin/lib/adminApi';
import type { AdminUser, DashboardStats } from '../../admin/lib/adminApi';

// ── Export helpers ────────────────────────────────────────────────────────

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown): string => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ].join('\n');
}

// ── Sub-components ────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      {children}
    </div>
  );
}

function ExportButton({
  onClick,
  loading,
  children,
}: {
  onClick: () => void;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
    >
      {loading ? (
        <svg
          className="h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      ) : (
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
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      )}
      {loading ? 'Exporting…' : children}
    </button>
  );
}

function DateRangeInputs({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
        <input
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
        <input
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 px-5 py-4 space-y-1">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

type ExportKey =
  | 'allUsersJson'
  | 'transactionsCsv'
  | 'userDataExport'
  | 'activityCsv';

export default function AdminReportsPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [usersLoading, setUsersLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  // Export loading states
  const [exportLoading, setExportLoading] = useState<Record<ExportKey, boolean>>({
    allUsersJson: false,
    transactionsCsv: false,
    userDataExport: false,
    activityCsv: false,
  });

  // Transactions report date range
  const [txFrom, setTxFrom] = useState('');
  const [txTo, setTxTo] = useState('');

  // User data export
  const [selectedUsername, setSelectedUsername] = useState('');
  const [userExportFormat, setUserExportFormat] = useState<'json' | 'csv'>('json');

  useEffect(() => {
    getUsers()
      .then((u) => {
        setUsers(u);
        if (u.length > 0) setSelectedUsername(u[0].username);
        setUsersLoading(false);
      })
      .catch(() => setUsersLoading(false));

    getDashboardStats()
      .then((s) => {
        setStats(s);
        setStatsLoading(false);
      })
      .catch(() => setStatsLoading(false));
  }, []);

  function setExporting(key: ExportKey, value: boolean) {
    setExportLoading((prev) => ({ ...prev, [key]: value }));
  }

  // ── Export handlers ──

  async function handleExportAllUsersJson() {
    setExporting('allUsersJson', true);
    try {
      const data = await getUsers();
      downloadBlob(toJson(data), 'all_users.json', 'application/json');
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting('allUsersJson', false);
    }
  }

  async function handleExportTransactionsCsv() {
    setExporting('transactionsCsv', true);
    try {
      const data = await getDashboardStats();
      const summary: Record<string, unknown>[] = [
        {
          report: 'Transaction Summary',
          date_from: txFrom || 'all time',
          date_to: txTo || 'all time',
          total_transactions: data.totalTransactions,
          total_income: (data.totalIncome / 100).toFixed(2),
          total_expenses: (data.totalExpenses / 100).toFixed(2),
          total_scheduled: data.totalScheduled,
          generated_at: new Date().toISOString(),
        },
      ];
      downloadBlob(toCsv(summary), 'transaction_summary.csv', 'text/csv');
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting('transactionsCsv', false);
    }
  }

  async function handleExportUserData() {
    if (!selectedUsername) return;
    setExporting('userDataExport', true);
    try {
      const targetUser = users.find((u) => u.username === selectedUsername);
      if (!targetUser) throw new Error('User not found');

      const { getUserDetail } = await import('../../admin/lib/adminApi');
      const detail = await getUserDetail(targetUser.id);

      if (userExportFormat === 'json') {
        downloadBlob(
          toJson(detail),
          `user_${selectedUsername}.json`,
          'application/json',
        );
      } else {
        // Export transactions as CSV for the user
        const rows = detail.transactions.map((t) => {
          const row = t as any;
          return {
            date: row.transaction_date ?? row.date ?? '',
            type: row.type ?? '',
            category: row.category ?? '',
            merchant: row.merchant ?? '',
            notes: row.notes ?? '',
            amount: ((row.amount_minor_units ?? 0) / 100).toFixed(2),
            currency: row.currency ?? '',
            status: row.status ?? '',
          } as Record<string, unknown>;
        });
        downloadBlob(
          toCsv(rows),
          `user_${selectedUsername}_transactions.csv`,
          'text/csv',
        );
      }
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting('userDataExport', false);
    }
  }

  async function handleExportActivityLog() {
    setExporting('activityCsv', true);
    try {
      const logs = await getActivityLogs(200);
      const rows: Record<string, unknown>[] = logs.map((l) => ({
        time: l.createdAt,
        admin: l.adminUsername,
        action_type: l.actionType,
        target_user: l.targetUsername ?? '',
        description: l.description ?? '',
      }));
      downloadBlob(toCsv(rows), 'activity_log.csv', 'text/csv');
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting('activityCsv', false);
    }
  }

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Page heading */}
        <div>
          <h2 className="text-xl font-bold text-gray-900">Reports &amp; Export</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Download data exports and review summary statistics.
          </p>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* ── Left: Export Options ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-5">
            <h3 className="text-base font-semibold text-gray-900">Export Data</h3>

            {/* 1. All Users */}
            <SectionCard title="All Users Data">
              <p className="text-xs text-gray-500">
                Download a full JSON snapshot of all user accounts.
              </p>
              <ExportButton
                onClick={handleExportAllUsersJson}
                loading={exportLoading.allUsersJson}
              >
                Export All (JSON)
              </ExportButton>
            </SectionCard>

            {/* 2. Transactions Report */}
            <SectionCard title="Transactions Report">
              <p className="text-xs text-gray-400 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-700">
                A per-user transaction export is available on the User Detail page.
                This export provides an aggregate summary from dashboard stats.
              </p>
              <DateRangeInputs
                from={txFrom}
                to={txTo}
                onFromChange={setTxFrom}
                onToChange={setTxTo}
              />
              <ExportButton
                onClick={handleExportTransactionsCsv}
                loading={exportLoading.transactionsCsv}
              >
                Export CSV
              </ExportButton>
            </SectionCard>

            {/* 3. User Data Export */}
            <SectionCard title="User Data Export">
              <p className="text-xs text-gray-500">
                Export a specific user's full data (transactions, accounts, loans, etc.).
              </p>
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="user-select"
                    className="block text-xs font-medium text-gray-500 mb-1"
                  >
                    Select User
                  </label>
                  {usersLoading ? (
                    <div className="h-9 bg-gray-100 rounded-lg animate-pulse w-full" />
                  ) : (
                    <select
                      id="user-select"
                      value={selectedUsername}
                      onChange={(e) => setSelectedUsername(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {users.length === 0 && (
                        <option value="">No users available</option>
                      )}
                      {users.map((u) => (
                        <option key={u.id} value={u.username}>
                          {u.username} — {u.fullName}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Format
                  </label>
                  <div className="flex gap-2">
                    {(['json', 'csv'] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setUserExportFormat(fmt)}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                          userExportFormat === fmt
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {fmt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  {userExportFormat === 'csv' && (
                    <p className="text-xs text-gray-400 mt-1.5">
                      CSV exports the user's transactions only.
                    </p>
                  )}
                </div>

                <ExportButton
                  onClick={handleExportUserData}
                  loading={exportLoading.userDataExport}
                >
                  Export
                </ExportButton>
              </div>
            </SectionCard>

            {/* 4. Activity Log */}
            <SectionCard title="Activity Log">
              <p className="text-xs text-gray-500">
                Download the last 200 admin activity log entries as CSV.
              </p>
              <ExportButton
                onClick={handleExportActivityLog}
                loading={exportLoading.activityCsv}
              >
                Export Log (CSV)
              </ExportButton>
            </SectionCard>
          </div>

          {/* ── Right: Summary Stats ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-5">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Quick Stats</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Live summary from the database.
              </p>
            </div>

            {statsLoading ? (
              <div className="grid grid-cols-2 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl border border-gray-200 px-5 py-4 space-y-2">
                    <div className="h-3 bg-gray-200 rounded animate-pulse w-24" />
                    <div className="h-7 bg-gray-200 rounded animate-pulse w-16" />
                  </div>
                ))}
              </div>
            ) : stats ? (
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Total Users" value={stats.totalUsers} />
                <StatCard
                  label="Active Users"
                  value={stats.activeUsers}
                  sub={`${stats.disabledUsers} disabled`}
                />
                <StatCard label="Total Transactions" value={stats.totalTransactions} />
                <StatCard label="Scheduled" value={stats.totalScheduled} />
                <StatCard
                  label="Total Income"
                  value={`$${(stats.totalIncome / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                />
                <StatCard
                  label="Total Expenses"
                  value={`$${(stats.totalExpenses / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <p className="text-sm">Stats unavailable</p>
              </div>
            )}

            <p className="text-xs text-gray-400 border-t border-gray-100 pt-4">
              For real-time stats, visit the{' '}
              <a href="/admin/dashboard" className="text-blue-600 hover:underline font-medium">
                Dashboard
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
