import { create } from 'zustand';

type Theme = 'dark' | 'light' | 'system';

interface UIState {
  theme: Theme;
  currency: string;
  sidebarOpen: boolean;
  setTheme: (t: Theme) => void;
  setCurrency: (c: string) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

const SETTINGS_KEY = 'pl_settings';

function loadSettings(): { theme: Theme; currency: string } {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw) as { theme: Theme; currency: string };
  } catch {
    // ignore
  }
  return { theme: 'dark', currency: 'GBP' };
}

const initial = loadSettings();

export const useUIStore = create<UIState>((set, get) => ({
  theme: initial.theme,
  currency: initial.currency,
  sidebarOpen: false,

  setTheme: (theme) => {
    set({ theme });
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme, currency: get().currency }));
    applyTheme(theme);
  },

  setCurrency: (currency) => {
    set({ currency });
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme: get().theme, currency }));
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
