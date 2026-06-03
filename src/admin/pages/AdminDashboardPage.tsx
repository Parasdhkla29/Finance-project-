import { useEffect, useState } from 'react';
import AdminLayout from '../AdminLayout';
import { getDashboardStats } from '../../admin/lib/adminApi';
import type { DashboardStats, ActivityLog } from '../../admin/lib/adminApi';

// ── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(minorUnits: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(minorUnits / 100);
}

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  return new Date(isoString).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTodayDate(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ── Icons ──────────────────────────────────────────────────────────────────

function IconUsers({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className ?? 'h-6 w-6'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconCheckCircle({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className ?? 'h-6 w-6'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function IconXCircle({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className ?? 'h-6 w-6'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function IconList({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className ?? 'h-6 w-6'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function IconClock({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className ?? 'h-6 w-6'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconTrendingUp({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className ?? 'h-6 w-6'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function IconTrendingDown({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className ?? 'h-6 w-6'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
      <polyline points="17 18 23 18 23 12" />
    </svg>
  );
}

// ── Action badge ───────────────────────────────────────────────────────────

interface ActionBadgeConfig {
  label: string;
  className: string;
}

const ACTION_BADGE_MAP: Record<string, ActionBadgeConfig> = {
  create_user:    { label: 'Create User',    className: 'bg-green-100 text-green-700' },
  update_user:    { label: 'Update User',    className: 'bg-blue-100 text-blue-700' },
  reset_password: { label: 'Reset Password', className: 'bg-amber-100 text-amber-700' },
  delete_user:    { label: 'Delete User',    className: 'bg-red-100 text-red-700' },
  disable_user:   { label: 'Disable User',   className: 'bg-red-100 text-red-700' },
  enable_user:    { label: 'Enable User',    className: 'bg-green-100 text-green-700' },
};

function ActionBadge({ actionType }: { actionType: string }) {
  const config = ACTION_BADGE_MAP[actionType] ?? {
    label: actionType.replace(/_/g, ' '),
    className: 'bg-gray-100 text-gray-700',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
}

function StatCard({ label, value, icon, iconBg }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-500 font-medium truncate">{label}</p>
        <p className="mt-1.5 text-2xl font-bold text-gray-900 leading-tight tabular-nums">
          {value}
        </p>
      </div>
      <div className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${iconBg}`}>
        {icon}
      </div>
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-24" />
          <div className="h-7 bg-gray-200 rounded w-16" />
        </div>
        <div className="w-11 h-11 bg-gray-200 rounded-xl shrink-0" />
      </div>
    </div>
  );
}

function SkeletonActivity() {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 py-3 border-b border-gray-100 last:border-0">
          <div className="h-4 bg-gray-200 rounded w-24 shrink-0" />
          <div className="h-4 bg-gray-200 rounded w-16 shrink-0" />
          <div className="h-4 bg-gray-200 rounded w-28 shrink-0" />
          <div className="h-4 bg-gray-200 rounded flex-1" />
          <div className="h-4 bg-gray-200 rounded flex-1" />
        </div>
      ))}
    </div>
  );
}

// ── Activity row ───────────────────────────────────────────────────────────

function ActivityRow({ log }: { log: ActivityLog }) {
  return (
    <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
      <td className="py-3 pr-4 text-sm text-gray-500 whitespace-nowrap">
        {formatRelativeTime(log.createdAt)}
      </td>
      <td className="py-3 pr-4 text-sm font-medium text-gray-900 whitespace-nowrap">
        {log.adminUsername}
      </td>
      <td className="py-3 pr-4 whitespace-nowrap">
        <ActionBadge actionType={log.actionType} />
      </td>
      <td className="py-3 pr-4 text-sm text-gray-700 whitespace-nowrap">
        {log.targetUsername ?? <span className="text-gray-400">—</span>}
      </td>
      <td className="py-3 text-sm text-gray-500">
        {log.description ?? <span className="text-gray-400">—</span>}
      </td>
    </tr>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getDashboardStats();
        if (!cancelled) setStats(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard stats.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  const statCards: StatCardProps[] = stats
    ? [
        {
          label: 'Total Users',
          value: stats.totalUsers.toLocaleString('en-GB'),
          icon: <IconUsers className="h-5 w-5 text-blue-600" />,
          iconBg: 'bg-blue-50',
        },
        {
          label: 'Active Users',
          value: stats.activeUsers.toLocaleString('en-GB'),
          icon: <IconCheckCircle className="h-5 w-5 text-green-600" />,
          iconBg: 'bg-green-50',
        },
        {
          label: 'Disabled Users',
          value: stats.disabledUsers.toLocaleString('en-GB'),
          icon: <IconXCircle className="h-5 w-5 text-red-600" />,
          iconBg: 'bg-red-50',
        },
        {
          label: 'Total Transactions',
          value: stats.totalTransactions.toLocaleString('en-GB'),
          icon: <IconList className="h-5 w-5 text-purple-600" />,
          iconBg: 'bg-purple-50',
        },
        {
          label: 'Total Income',
          value: formatCurrency(stats.totalIncome),
          icon: <IconTrendingUp className="h-5 w-5 text-green-600" />,
          iconBg: 'bg-green-50',
        },
        {
          label: 'Total Expenses',
          value: formatCurrency(stats.totalExpenses),
          icon: <IconTrendingDown className="h-5 w-5 text-red-600" />,
          iconBg: 'bg-red-50',
        },
        {
          label: 'Scheduled Payments',
          value: stats.totalScheduled.toLocaleString('en-GB'),
          icon: <IconClock className="h-5 w-5 text-amber-600" />,
          iconBg: 'bg-amber-50',
        },
      ]
    : [];

  const recentActivity = stats?.recentActivity.slice(0, 10) ?? [];

  return (
    <AdminLayout>
      {/* Page heading */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="mt-1 text-sm text-gray-500">{formatTodayDate()}</p>
      </div>

      {/* Error state */}
      {error !== null && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong className="font-semibold">Error:</strong> {error}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading
          ? Array.from({ length: 7 }).map((_, i) => <SkeletonCard key={i} />)
          : statCards.map((card) => (
              <StatCard key={card.label} {...card} />
            ))}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Recent Activity</h3>
          <p className="text-sm text-gray-500 mt-0.5">Last 10 admin actions</p>
        </div>

        <div className="p-6">
          {loading ? (
            <SkeletonActivity />
          ) : recentActivity.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">No recent activity found.</p>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-left" style={{ minWidth: '640px' }}>
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      When
                    </th>
                    <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Admin
                    </th>
                    <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Action
                    </th>
                    <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Target
                    </th>
                    <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivity.map((log) => (
                    <ActivityRow key={log.id} log={log} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
