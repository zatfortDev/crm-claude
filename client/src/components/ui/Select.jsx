import { forwardRef, useId } from 'react';
import { cn } from '../../lib/utils.js';

export const Select = forwardRef(function Select(
  { label, error, options = [], placeholder, className, id, required, children, ...props },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${selectId}-error` : undefined}
        className={cn(
          'h-9 rounded-md border bg-surface px-3 text-sm text-foreground',
          'focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-muted-soft',
          error ? 'border-danger' : 'border-border focus:border-primary',
          className,
        )}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        {children}
      </select>
      {error && (
        <p id={`${selectId}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
});
