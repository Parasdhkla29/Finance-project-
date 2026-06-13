import { useMemo, useState } from 'react';
import type { Account, Transaction } from '../../core/types';
import { formatCurrency, isScheduled } from '../../core/types';

// ── Types ──────────────────────────────────────────────────────────────────

interface AccountWithBalance {
  account: Account;
  balance: number;
}

// ── Icons ──────────────────────────────────────────────────────────────────

const TYPE_EMOJI: Record<string, string> = {
  checking: '🏦',
  savings: '🐷',
  cash: '💵',
  credit: '💳',
  investment: '📈',
};

// ── Balance computation ────────────────────────────────────────────────────

function computeBalances(accounts: Account[], transactions: Transaction[]): AccountWithBalance[] {
  const map = new Map<string, number>();
  accounts.forEach((a) => map.set(a.id, 0));

  for (const t of transactions) {
    if (t.deletedAt) continue;

    if (t.type === 'income') {
      if (!isScheduled(t)) {
        map.set(t.accountId, (map.get(t.accountId) ?? 0) + t.amountMinorUnits);
      } else if (t.status === 'partially_received' && t.receivedAmountMinorUnits) {
        map.set(t.accountId, (map.get(t.accountId) ?? 0) + t.receivedAmountMinorUnits);
      }
    } else if (t.type === 'expense') {
      if (!isScheduled(t)) {
        map.set(t.accountId, (map.get(t.accountId) ?? 0) - t.amountMinorUnits);
      }
    } else if (t.type === 'transfer') {
      if (!isScheduled(t)) {
        map.set(t.accountId, (map.get(t.accountId) ?? 0) - t.amountMinorUnits);
        if (t.toAccountId) {
          map.set(t.toAccountId, (map.get(t.toAccountId) ?? 0) + t.amountMinorUnits);
        }
      }
    }
  }

  return accounts
    .filter((a) => !a.isArchived && !a.deletedAt)
    .map((a) => ({ account: a, balance: map.get(a.id) ?? 0 }));
}

function buildDisplayOrder(items: AccountWithBalance[]): {
  firstRow: AccountWithBalance[];
  more: AccountWithBalance[];
} {
  const cash = items.filter((i) => i.account.type === 'cash');
  const nonCash = items.filter((i) => i.account.type !== 'cash');
  nonCash.sort((a, b) => b.balance - a.balance);

  let firstRow: AccountWithBalance[];
  let more: AccountWithBalance[];

  if (cash.length > 0) {
    firstRow = [...nonCash.slice(0, 2), cash[0]].filter(Boolean);
    more = [...nonCash.slice(2), ...cash.slice(1)];
  } else {
    firstRow = nonCash.slice(0, 3);
    more = nonCash.slice(3);
  }

  return { firstRow, more };
}

// ── Account card ───────────────────────────────────────────────────────────

function AccountCard({
  item,
  isActive,
  onClick,
}: {
  item: AccountWithBalance;
  isActive: boolean;
  onClick: () => void;
}) {
  const neg = item.balance < 0;

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start w-full p-2.5 rounded-xl border transition-all active:scale-95 ${
        isActive
          ? 'bg-blue-50 border-blue-300 shadow-sm'
          : 'bg-slate-50 border-slate-200 hover:bg-white hover:border-slate-300'
      }`}
    >
      {/* Icon + name row */}
      <div className="flex items-center gap-1.5 w-full mb-1 min-w-0">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: item.account.color }}
        />
        <span
          className={`text-xs font-semibold truncate leading-tight ${
            isActive ? 'text-blue-700' : 'text-slate-700'
          }`}
        >
          {item.account.name}
        </span>
      </div>

      {/* Balance */}
      <p
        className={`text-sm font-bold leading-tight ${
          isActive ? 'text-blue-800' : neg ? 'text-red-600' : 'text-slate-900'
        }`}
      >
        {neg ? '−' : ''}{formatCurrency(Math.abs(item.balance), item.account.currency)}
      </p>

      {/* Account type pill */}
      <span className="mt-1 text-xs text-slate-400 leading-none">
        {TYPE_EMOJI[item.account.type] ?? '🏦'} {item.account.type}
      </span>
    </button>
  );
}

// ── AccountBreakdown ───────────────────────────────────────────────────────

interface AccountBreakdownProps {
  accounts: Account[];
  transactions: Transaction[];
  accountFilter: string[];
  onAccountClick: (accountId: string) => void;
}

export default function AccountBreakdown({
  accounts,
  transactions,
  accountFilter,
  onAccountClick,
}: AccountBreakdownProps) {
  const [expanded, setExpanded] = useState(false);

  const withBalances = useMemo(
    () => computeBalances(accounts, transactions),
    [accounts, transactions],
  );

  const { firstRow, more } = useMemo(() => buildDisplayOrder(withBalances), [withBalances]);

  const totalBalance = useMemo(
    () => withBalances.reduce((s, i) => s + i.balance, 0),
    [withBalances],
  );

  const hasMore = more.length > 0;

  // Build rows for expanded state
  const expandedRows = useMemo(() => {
    if (!expanded || more.length === 0) return [];
    const rows: AccountWithBalance[][] = [];
    for (let i = 0; i < more.length; i += 3) {
      rows.push(more.slice(i, i + 3));
    }
    return rows;
  }, [expanded, more]);

  if (firstRow.length === 0) return null;

  function handleClick(accountId: string) {
    if (accountFilter.length === 1 && accountFilter[0] === accountId) {
      onAccountClick('__clear__');
    } else {
      onAccountClick(accountId);
    }
  }

  return (
    <div className="px-4 py-3 border-b border-slate-100">
      {/* Section header */}
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Account Balances
        </p>
        <p className="text-xs font-bold text-slate-600">
          {formatCurrency(Math.abs(totalBalance), accounts[0]?.currency ?? 'GBP')}
          <span className="text-slate-400 font-normal"> total</span>
        </p>
      </div>

      {/* First row — always visible */}
      <div className="grid grid-cols-3 gap-2">
        {firstRow.map((item) => (
          <AccountCard
            key={item.account.id}
            item={item}
            isActive={accountFilter.includes(item.account.id)}
            onClick={() => handleClick(item.account.id)}
          />
        ))}
      </div>

      {/* Expanded rows */}
      {expanded && expandedRows.map((row, ri) => (
        <div key={ri} className="grid grid-cols-3 gap-2 mt-2">
          {row.map((item) => (
            <AccountCard
              key={item.account.id}
              item={item}
              isActive={accountFilter.includes(item.account.id)}
              onClick={() => handleClick(item.account.id)}
            />
          ))}
          {/* Fill empty cells in partial last row */}
          {row.length < 3 && Array.from({ length: 3 - row.length }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
        </div>
      ))}

      {/* More / Less toggle */}
      {hasMore && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-50"
        >
          {expanded ? (
            <>
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              Show Less
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              +{more.length} More Account{more.length !== 1 ? 's' : ''}
            </>
          )}
        </button>
      )}
    </div>
  );
}
