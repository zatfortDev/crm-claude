import { cn } from '../../lib/utils.js';

export function Card({ className, children, ...props }) {
  return (
    <div
      className={cn('rounded-lg border border-border bg-surface shadow-card', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, description, actions, className }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pt-5', className)}>
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function CardContent({ className, children }) {
  return <div className={cn('px-5 py-5', className)}>{children}</div>;
}
