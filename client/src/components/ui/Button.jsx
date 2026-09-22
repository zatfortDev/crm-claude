import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils.js';

const variants = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
  secondary: 'border border-border bg-surface text-foreground hover:bg-muted-soft',
  ghost: 'text-foreground hover:bg-muted-soft',
  danger: 'bg-danger text-white hover:bg-danger/90',
};

const sizes = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-10 px-5 text-sm',
  icon: 'size-9',
};

/**
 * Botón base. Acepta `as` para renderizar otro elemento (p. ej. `as={Link}` de react-router)
 * manteniendo los estilos.
 */
export function Button({
  as: Component = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  type,
  ...props
}) {
  const isButton = Component === 'button';
  return (
    <Component
      type={isButton ? (type ?? 'button') : type}
      disabled={isButton ? disabled || loading : undefined}
      aria-disabled={!isButton && (disabled || loading) ? true : undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </Component>
  );
}
