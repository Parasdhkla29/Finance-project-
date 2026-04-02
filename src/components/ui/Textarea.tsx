import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          rows={3}
          {...props}
          className={clsx(
            'w-full rounded-lg px-3 py-2 text-sm resize-none',
            'bg-white border text-slate-900 placeholder-slate-400',
            'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent',
            error ? 'border-red-500' : 'border-slate-300 hover:border-slate-400',
            className,
          )}
        />
        {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';
export default Textarea;
