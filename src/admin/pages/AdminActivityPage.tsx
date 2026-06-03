import { useState, useEffect, useMemo } from 'react';
import AdminLayout from '../AdminLayout';
import { getActivityLogs } from '../../admin/lib/adminApi';
import type { ActivityLog } from '../../admin/lib/adminApi';

// ── CSV export ────────────────────────────────────────────────────────────

function activityToCsv(logs: ActivityLog[]): string {
  if (logs.length === 0) return '';
  const headers = ['time', 'admin', 'action_type', 'target_user', 'description'];
  const escape = (v: string | undefined): string => {
    const s = v ?? '';
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const rows = logs.map((l) => [
    escape(formatDateTime(l.createdAt)),
    escape(l.adminUsername),
    escape(l.actionType),
    escape(l.targetUsername),
    escape(l.description),
  ]);
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
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

// ── Formatting ────────────────────────────────────────────────────────────

function formatDateTime(raw: string): string {
  const d = new Date(raw);
  return (
    d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  );
}

// ── Action badge ──────────────────────────────────────────────────────────

type ActionColor = 'green' | 'blue' | 'amber' | 'red' | 'gray';

function actionMeta(actionType: string): { label: string; color: ActionColor } {
  switch (actionType) {
    case 'create_user':
      return { label: 'Created User', color: 'green' };
    case 'update_user':
      return { label: 'Updated User', color: 'blue' };
    case 'reset_password':
      return { label: 'Reset Password', color: 'amber' };
    case 'delete_user':
      return { label: 'Deleted User', color: 'red' };
    case 'disable':
    case 'disable_user':
      return { label: 'Disabled', color: 'red' };
    case 'login':
      return { label: 'Login', color: 'gray' };
    default:
      return {
        label: actionType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        color: 'gray',
      };
  }
}

const COLOR_MAP: Record<ActionColor, string> = {
  green: 'bg-green-100 text-green-700',
  blue: 'bg-blue-100 text-blue-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  gray: 'bg-gray-100 text-gray-600',
};

function ActionBadge({ actionType }: { actionType: string }) {
  const { label, color } = actionMeta(actionType);
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${COLOR_MAP[color]}`}
    >
      {label}
    </span>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>
      {[...Array(5)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: `${60 + (i * 17) % 35}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

function Pagination({
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
      <p className="text-sm text-gray-500">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={page === 1}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
          Prev
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={page === totalPages}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function AdminActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getActivityLogs(200)
      .then((data) => {
        setLogs(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load activity logs');
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : null;

    return logs.filter((l) => {
      if (q) {
        const matchSearch =
          l.adminUsername.toLowerCase().includes(q) ||
          (l.targetUsername ?? '').toLowerCase().includes(q) ||
          (l.description ?? '').toLowerCase().includes(q);
        if (!matchSearch) return false;
      }
      const ts = new Date(l.createdAt).getTime();
      if (from && ts < from) return false;
      if (to && ts > to) return false;
      return true;
    });
  }, [logs, search, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageSlice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleFilterChange() {
    setPage(1);
  }

  function handleExport() {
    downloadBlob(activityToCsv(filtered), 'activity_log.csv', 'text/csv');
  }

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Page header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Activity Log</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Admin actions and system events
            </p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV
          </button>
        </div>

        {/* Filter controls */}
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="activity-search" className="block text-xs font-medium text-gray-500 mb-1">
                Search
              </label>
              <input
                id="activity-search"
                type="search"
                placeholder="Admin, target user, description…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  handleFilterChange();
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="date-from" className="block text-xs font-medium text-gray-500 mb-1">
                From
              </label>
              <input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  handleFilterChange();
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="date-to" className="block text-xs font-medium text-gray-500 mb-1">
                To
              </label>
              <input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  handleFilterChange();
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {(search || dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setDateFrom('');
                  setDateTo('');
                  setPage(1);
                }}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          {!loading && (
            <p className="text-xs text-gray-400 mt-2">
              Showing {filtered.length} of {logs.length} records
            </p>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {error && (
            <div className="px-6 py-10 text-center">
              <p className="text-sm font-medium text-red-600">{error}</p>
            </div>
          )}

          {!error && (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Time
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Admin
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Action
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Target User
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {loading
                      ? [...Array(8)].map((_, i) => <SkeletonRow key={i} />)
                      : pageSlice.length === 0
                        ? (
                          <tr>
                            <td colSpan={5}>
                              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                <p className="text-sm">No activity recorded yet.</p>
                              </div>
                            </td>
                          </tr>
                        )
                        : pageSlice.map((log) => (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs font-mono">
                              {formatDateTime(log.createdAt)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="font-medium text-gray-800">@{log.adminUsername}</span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <ActionBadge actionType={log.actionType} />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                              {log.targetUsername ? (
                                <span>@{log.targetUsername}</span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-500 max-w-xs truncate">
                              {log.description ?? (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>

              {!loading && (
                <Pagination
                  page={safePage}
                  totalPages={totalPages}
                  onPrev={() => setPage((p) => Math.max(1, p - 1))}
                  onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
                />
              )}
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
