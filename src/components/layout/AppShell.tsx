import { type ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useUIStore, applyTheme } from '../../store/useUIStore';
import Modal from '../ui/Modal';
import TransactionForm from '../transactions/TransactionForm';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/transactions': 'Transactions',
  '/loans': 'Loans',
  '/subscriptions': 'Subscriptions',
  '/budgets': 'Budgets',
  '/insights': 'Insights',
  '/goals': 'Goals',
  '/settings': 'Settings',
};

export default function AppShell({ children }: { children: ReactNode }) {
  const { theme, sidebarOpen, setSidebarOpen } = useUIStore();
  const location = useLocation();
  const pageTitle = PAGE_TITLES[location.pathname] ?? 'PrivyLedger';
  const [showFab, setShowFab] = useState(false);

  // Apply theme on mount and whenever it changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

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

      {/* Mobile FAB — quick add transaction */}
      <button
        onClick={() => setShowFab(true)}
        className="fixed bottom-6 right-4 z-30 lg:hidden w-14 h-14 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-white rounded-full shadow-lg shadow-sky-500/30 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        aria-label="Add transaction"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
      </button>

      {/* FAB modal */}
      <Modal open={showFab} onClose={() => setShowFab(false)} title="Add Transaction">
        <TransactionForm onDone={() => setShowFab(false)} />
      </Modal>
    </div>
  );
}
