import { forwardRef, type SelectHTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, id, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-slate-700">
            {label}
            {props.required && <span className="text-red-600 ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          {...props}
          className={clsx(
            'w-full rounded-lg px-3 py-2 text-sm',
            'bg-white border text-slate-900',
            'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent',
            'transition-colors duration-150',
            error ? 'border-red-500' : 'border-slate-300 hover:border-slate-400',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            className,
          )}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
      </div>
    );
  },
);
Select.displayName = 'Select';
export default Select;
