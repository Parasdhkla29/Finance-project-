import { create } from 'zustand';

type Theme = 'dark' | 'light' | 'system';

interface UIState {
  theme: Theme;
  currency: string;
  defaultAccountId: string | null;
  sidebarOpen: boolean;
  setTheme: (t: Theme) => void;
  setCurrency: (c: string) => void;
  setDefaultAccountId: (id: string | null) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

const SETTINGS_KEY = 'pl_settings';

function loadSettings(): { theme: Theme; currency: string; defaultAccountId: string | null } {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { theme: Theme; currency: string; defaultAccountId?: string | null };
      return { theme: parsed.theme, currency: parsed.currency, defaultAccountId: parsed.defaultAccountId ?? null };
    }
  } catch {
    // ignore
  }
  return { theme: 'dark', currency: 'GBP', defaultAccountId: null };
}

function saveSettings(theme: Theme, currency: string, defaultAccountId: string | null) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme, currency, defaultAccountId }));
}

const initial = loadSettings();

export const useUIStore = create<UIState>((set, get) => ({
  theme: initial.theme,
  currency: initial.currency,
  defaultAccountId: initial.defaultAccountId,
  sidebarOpen: false,

  setTheme: (theme) => {
    set({ theme });
    const { currency, defaultAccountId } = get();
    saveSettings(theme, currency, defaultAccountId);
    applyTheme(theme);
  },

  setCurrency: (currency) => {
    set({ currency });
    const { theme, defaultAccountId } = get();
    saveSettings(theme, currency, defaultAccountId);
  },

  setDefaultAccountId: (defaultAccountId) => {
    set({ defaultAccountId });
    const { theme, currency } = get();
    saveSettings(theme, currency, defaultAccountId);
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
