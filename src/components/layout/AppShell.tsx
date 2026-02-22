import { type ReactNode, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useUIStore, applyTheme } from '../../store/useUIStore';

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
    </div>
  );
}
