import { type ReactNode, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useUIStore, applyTheme } from '../../store/useUIStore';
import Modal from '../ui/Modal';
import TransactionForm from '../transactions/TransactionForm';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/transactions': 'Transactions',
  '/loans': 'Loans',
  '/credit-cards': 'Credit Cards',
  '/subscriptions': 'Subscriptions',
  '/budgets': 'Budgets',
  '/insights': 'Insights',
  '/goals': 'Goals',
  '/settings': 'Settings',
};

// ── FAB menu items ─────────────────────────────────────────────────────────

interface FabItem {
  icon: string;
  label: string;
  sub: string;
  bg: string;
  action: 'transaction' | 'navigate';
  path?: string;
}

const FAB_ITEMS: FabItem[] = [
  {
    icon: '💸',
    label: 'Transaction',
    sub: 'Log income or expense',
    bg: 'bg-sky-900/60',
    action: 'transaction',
  },
  {
    icon: '📊',
    label: 'Budget',
    sub: 'Create a spending limit',
    bg: 'bg-emerald-900/60',
    action: 'navigate',
    path: '/budgets',
  },
  {
    icon: '🏦',
    label: 'Loan',
    sub: 'Record borrowed/lent money',
    bg: 'bg-amber-900/60',
    action: 'navigate',
    path: '/loans',
  },
  {
    icon: '💳',
    label: 'Credit Card',
    sub: 'Add or manage a card',
    bg: 'bg-purple-900/60',
    action: 'navigate',
    path: '/credit-cards',
  },
  {
    icon: '🔁',
    label: 'Subscription',
    sub: 'Track a recurring payment',
    bg: 'bg-blue-900/60',
    action: 'navigate',
    path: '/subscriptions',
  },
  {
    icon: '🎯',
    label: 'Goal',
    sub: 'Set a savings target',
    bg: 'bg-pink-900/60',
    action: 'navigate',
    path: '/goals',
  },
];

// ── AppShell ───────────────────────────────────────────────────────────────

export default function AppShell({ children }: { children: ReactNode }) {
  const { theme, sidebarOpen, setSidebarOpen } = useUIStore();
  const location = useLocation();
  const navigate = useNavigate();
  const pageTitle = PAGE_TITLES[location.pathname] ?? 'PrivyLedger';

  const [fabOpen, setFabOpen] = useState(false);
  const [showTxnModal, setShowTxnModal] = useState(false);

  // Close FAB menu on route change
  useEffect(() => { setFabOpen(false); }, [location.pathname]);

  // Apply theme on mount and whenever it changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function handleFabItem(item: FabItem) {
    setFabOpen(false);
    if (item.action === 'transaction') {
      setShowTxnModal(true);
    } else if (item.path) {
      navigate(item.path);
    }
  }

  return (
    <div className="flex h-dvh bg-slate-950 text-slate-100 overflow-hidden">
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex lg:w-60 xl:w-64 shrink-0 flex-col bg-slate-900 border-r border-slate-700"
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'env(safe-area-inset-left)' }}
      >
        <Sidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 border-r border-slate-700 lg:hidden overflow-y-auto">
            <Sidebar mobile />
          </aside>
        </>
      )}

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header title={pageTitle} />
        <main
          className="flex-1 overflow-y-auto"
          id="main-content"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {children}
        </main>
      </div>

      {/* ── Mobile FAB ── */}

      {/* Backdrop */}
      {fabOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm lg:hidden"
          onClick={() => setFabOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Expanded menu items */}
      {fabOpen && (
        <div
          className="fixed bottom-24 right-4 z-40 flex flex-col gap-2 items-end lg:hidden"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          {FAB_ITEMS.map((item, i) => (
            <button
              key={item.label}
              onClick={() => handleFabItem(item)}
              className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 min-w-[180px] hover:border-slate-500 hover:bg-slate-750 transition-all active:scale-95 text-left shadow-xl"
              style={{
                animationDelay: `${i * 30}ms`,
              }}
            >
              <div className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center text-lg shrink-0`}>
                {item.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-100 leading-tight">{item.label}</p>
                <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{item.sub}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => setFabOpen((o) => !o)}
        className={`fixed bottom-6 right-4 z-40 lg:hidden w-14 h-14 rounded-[18px] shadow-lg flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
          fabOpen
            ? 'bg-slate-800 border border-slate-600 text-slate-200 shadow-none'
            : 'bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-white shadow-sky-500/30'
        }`}
        aria-label={fabOpen ? 'Close quick-add menu' : 'Open quick-add menu'}
        aria-expanded={fabOpen}
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        {fabOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        )}
      </button>

      {/* Transaction modal */}
      <Modal open={showTxnModal} onClose={() => setShowTxnModal(false)} title="Add Transaction">
        <TransactionForm onDone={() => setShowTxnModal(false)} />
      </Modal>
    </div>
  );
}
