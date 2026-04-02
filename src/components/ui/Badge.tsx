import { clsx } from 'clsx';
import type { ReactNode } from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

const variants: Record<BadgeVariant, string> = {
  default: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-100 text-emerald-600 ring-1 ring-emerald-300',
  warning: 'bg-amber-100 text-amber-600 ring-1 ring-amber-300',
  danger:  'bg-red-100 text-red-600 ring-1 ring-red-300',
  info:    'bg-sky-100 text-sky-600 ring-1 ring-sky-300',
  purple:  'bg-purple-100 text-purple-600 ring-1 ring-purple-300',
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
