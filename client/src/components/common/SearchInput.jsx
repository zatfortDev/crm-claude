import { Search } from 'lucide-react';

/** Campo de búsqueda controlado (el debounce lo aplica el hook useDebounce). */
export function SearchInput({ value, onChange, placeholder = 'Buscar…', label = 'Buscar' }) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-9 w-full rounded-md border border-border bg-surface py-2 pr-3 pl-9 text-sm placeholder:text-muted focus:border-primary focus:outline-none"
      />
    </div>
  );
}
