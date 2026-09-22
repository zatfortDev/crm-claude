import { cn } from '../../lib/utils.js';

/** Pestañas accesibles (patrón tablist). El contenido lo renderiza el consumidor. */
export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div
      role="tablist"
      aria-label="Secciones"
      className={cn('flex gap-1 border-b border-border', className)}
    >
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(tab.value)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              selected
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-foreground',
            )}
          >
            {tab.label}
            {typeof tab.count === 'number' && (
              <span className="ml-1.5 rounded-full bg-muted-soft px-1.5 py-0.5 text-xs text-muted">
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
