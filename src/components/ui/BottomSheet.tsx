import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  fullScreen?: boolean;
  hideHandle?: boolean;
  zIndex?: number;
}

export default function BottomSheet({
  open,
  onClose,
  title,
  children,
  fullScreen = false,
  hideHandle = false,
  zIndex = 50,
}: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-end"
      style={{ zIndex: zIndex * 10 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'bs-title' : undefined}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={clsx(
          'relative w-full bg-white rounded-t-3xl shadow-2xl flex flex-col sheet-slide-up',
          fullScreen ? 'max-h-[96dvh]' : 'max-h-[88dvh]',
        )}
      >
        {/* Drag handle */}
        {!hideHandle && (
          <div className="flex justify-center pt-3 pb-1 shrink-0" aria-hidden="true">
            <div className="w-10 h-1.5 bg-slate-200 rounded-full" />
          </div>
        )}

        {/* Title row */}
        {title && (
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0">
            <h2 id="bs-title" className="text-base font-semibold text-slate-900">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Close"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto flex-1 overscroll-contain">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
