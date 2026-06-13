import { create } from 'zustand';

type Theme = 'dark' | 'light' | 'system';

interface UIState {
  theme: Theme;
  currency: string;
  defaultAccountId: string | null;
  sidebarOpen: boolean;
  showAccountBreakdown: boolean;
  setTheme: (t: Theme) => void;
  setCurrency: (c: string) => void;
  setDefaultAccountId: (id: string | null) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setShowAccountBreakdown: (v: boolean) => void;
}

const SETTINGS_KEY = 'pl_settings';

function loadSettings(): { theme: Theme; currency: string; defaultAccountId: string | null; showAccountBreakdown: boolean } {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as {
        theme: Theme;
        currency: string;
        defaultAccountId?: string | null;
        showAccountBreakdown?: boolean;
      };
      return {
        theme: parsed.theme,
        currency: parsed.currency,
        defaultAccountId: parsed.defaultAccountId ?? null,
        showAccountBreakdown: parsed.showAccountBreakdown ?? false,
      };
    }
  } catch {
    // ignore
  }
  return { theme: 'dark', currency: 'GBP', defaultAccountId: null, showAccountBreakdown: false };
}

function saveSettings(
  theme: Theme,
  currency: string,
  defaultAccountId: string | null,
  showAccountBreakdown: boolean,
) {
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({ theme, currency, defaultAccountId, showAccountBreakdown }),
  );
}

const initial = loadSettings();

export const useUIStore = create<UIState>((set, get) => ({
  theme: initial.theme,
  currency: initial.currency,
  defaultAccountId: initial.defaultAccountId,
  sidebarOpen: false,
  showAccountBreakdown: initial.showAccountBreakdown,

  setTheme: (theme) => {
    set({ theme });
    const { currency, defaultAccountId, showAccountBreakdown } = get();
    saveSettings(theme, currency, defaultAccountId, showAccountBreakdown);
    applyTheme(theme);
  },

  setCurrency: (currency) => {
    set({ currency });
    const { theme, defaultAccountId, showAccountBreakdown } = get();
    saveSettings(theme, currency, defaultAccountId, showAccountBreakdown);
  },

  setDefaultAccountId: (defaultAccountId) => {
    set({ defaultAccountId });
    const { theme, currency, showAccountBreakdown } = get();
    saveSettings(theme, currency, defaultAccountId, showAccountBreakdown);
  },

  setShowAccountBreakdown: (showAccountBreakdown) => {
    set({ showAccountBreakdown });
    const { theme, currency, defaultAccountId } = get();
    saveSettings(theme, currency, defaultAccountId, showAccountBreakdown);
  },

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  } else {
    root.classList.toggle('dark', theme === 'dark');
  }
}
