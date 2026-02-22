import { useUIStore } from '../../store/useUIStore';

function MenuIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
  );
}

export default function Header({ title }: { title?: string }) {
  const { toggleSidebar } = useUIStore();

  return (
    <header
      className="flex flex-col border-b border-slate-700 bg-slate-900 shrink-0 lg:hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex items-center gap-3 h-14 px-4">
      <button
        onClick={toggleSidebar}
        className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
        aria-label="Open navigation menu"
      >
        <MenuIcon />
      </button>
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 bg-sky-500 rounded flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-xs">P</span>
        </div>
        <span className="text-slate-100 font-semibold text-sm">{title ?? 'PrivyLedger'}</span>
      </div>
      </div>
    </header>
  );
}
