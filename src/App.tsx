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
import { seedDefaultAccount } from './store/useAccountStore';
import { processRecurringRules } from './core/recurring';
import { applyTheme } from './store/useUIStore';

function useAppInit() {
  useEffect(() => {
    seedDefaultAccount().catch(console.error);
    processRecurringRules().catch(console.error);
    const settings = localStorage.getItem('pl_settings');
    if (settings) {
      try {
        const parsed = JSON.parse(settings) as { theme: string };
        applyTheme(parsed.theme as 'dark' | 'light' | 'system');
      } catch {
        applyTheme('dark');
      }
    } else {
      applyTheme('dark');
    }
  }, []);
}

export default function App() {
  useAppInit();

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
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
    </BrowserRouter>
  );
}
