import { clsx } from 'clsx';
import type { ReactNode } from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

const variants: Record<BadgeVariant, string> = {
  default: 'bg-slate-700 text-slate-300',
  success: 'bg-emerald-900/50 text-emerald-400 ring-1 ring-emerald-700',
  warning: 'bg-amber-900/50 text-amber-400 ring-1 ring-amber-700',
  danger:  'bg-red-900/50 text-red-400 ring-1 ring-red-700',
  info:    'bg-sky-900/50 text-sky-400 ring-1 ring-sky-700',
  purple:  'bg-purple-900/50 text-purple-400 ring-1 ring-purple-700',
};

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export default function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
