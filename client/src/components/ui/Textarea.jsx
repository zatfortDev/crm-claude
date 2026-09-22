import { forwardRef, useId } from 'react';
import { cn } from '../../lib/utils.js';

export const Textarea = forwardRef(function Textarea(
  { label, error, hint, className, id, rows = 3, ...props },
  ref,
) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={textareaId} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${textareaId}-error` : undefined}
        className={cn(
          'rounded-md border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted',
          'focus:outline-none focus:ring-2 focus:ring-primary/30',
          error ? 'border-danger' : 'border-border focus:border-primary',
          className,
        )}
        {...props}
      />
      {error && (
        <p id={`${textareaId}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      {!error && hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
});
