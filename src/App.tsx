import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import AppShell from './components/layout/AppShell';
import DashboardPage from './pages/DashboardPage';
import TransactionsPage from './pages/TransactionsPage';
import LoansPage from './pages/LoansPage';
import CreditCardsPage from './pages/CreditCardsPage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import BudgetsPage from './pages/BudgetsPage';
import InsightsPage from './pages/InsightsPage';
import GoalsPage from './pages/GoalsPage';
import SettingsPage from './pages/SettingsPage';

import LoginPage from './pages/LoginPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import AuthGuard from './auth/AuthGuard';
import AdminGuard from './auth/AdminGuard';
import { useAuthStore } from './auth/useAuthStore';

import AdminLoginPage from './admin/pages/AdminLoginPage';
import AdminDashboardPage from './admin/pages/AdminDashboardPage';
import AdminUsersPage from './admin/pages/AdminUsersPage';
import AdminUserDetailPage from './admin/pages/AdminUserDetailPage';
import AdminActivityPage from './admin/pages/AdminActivityPage';
import AdminReportsPage from './admin/pages/AdminReportsPage';

import { seedDefaultAccount, useAccountStore } from './store/useAccountStore';
import { useTransactionStore } from './store/useTransactionStore';
import { useLoanStore } from './store/useLoanStore';
import { useSubscriptionStore } from './store/useSubscriptionStore';
import { useBudgetStore } from './store/useBudgetStore';
import { useGoalStore } from './store/useGoalStore';
import { useCreditCardStore } from './store/useCreditCardStore';
import { processRecurringRules } from './core/recurring';
import { applyTheme } from './store/useUIStore';

// ── App initialisation ────────────────────────────────────────────────────────

function useAppInit() {
  const initSession = useAuthStore((s) => s.initSession);
  const user = useAuthStore((s) => s.user);

  // Apply theme and restore session on first render
  useEffect(() => {
    const raw = localStorage.getItem('pl_settings');
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { theme: string };
        applyTheme(parsed.theme as 'dark' | 'light' | 'system');
      } catch {
        applyTheme('dark');
      }
    } else {
      applyTheme('dark');
    }
    void initSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear all store data when user logs out to prevent data leaking to the next user
  useEffect(() => {
    if (!user) {
      useAccountStore.setState({ accounts: [] });
      useTransactionStore.setState({ transactions: [] });
      useLoanStore.setState({ loans: [] });
      useSubscriptionStore.setState({ subscriptions: [] });
      useBudgetStore.setState({ budgets: [] });
      useGoalStore.setState({ goals: [] });
      useCreditCardStore.setState({ cards: [] });
    }
  }, [user]);

  // After a regular user logs in, seed their default account and generate recurring transactions
  useEffect(() => {
    if (user?.role === 'user') {
      void seedDefaultAccount();
      void processRecurringRules();
    }
  // user?.id changes when a different user logs in; role stays stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
}

// ── Protected user shell ──────────────────────────────────────────────────────

function UserApp() {
  return (
    <AuthGuard>
      <AppShell>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/loans" element={<LoansPage />} />
          <Route path="/credit-cards" element={<CreditCardsPage />} />
          <Route path="/subscriptions" element={<SubscriptionsPage />} />
          <Route path="/budgets" element={<BudgetsPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </AppShell>
    </AuthGuard>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function App() {
  useAppInit();

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        {/* ── Public ───────────────────────────────────────────────────── */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />

        {/* ── Admin portal ─────────────────────────────────────────────── */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin/dashboard" element={<AdminGuard><AdminDashboardPage /></AdminGuard>} />
        <Route path="/admin/users" element={<AdminGuard><AdminUsersPage /></AdminGuard>} />
        <Route path="/admin/users/:userId" element={<AdminGuard><AdminUserDetailPage /></AdminGuard>} />
        <Route path="/admin/activity" element={<AdminGuard><AdminActivityPage /></AdminGuard>} />
        <Route path="/admin/reports" element={<AdminGuard><AdminReportsPage /></AdminGuard>} />

        {/* ── Authenticated user app (catch-all) ───────────────────────── */}
        <Route path="/*" element={<UserApp />} />
      </Routes>
    </BrowserRouter>
  );
}
