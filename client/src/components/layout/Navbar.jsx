import { Menu, Search, Bell } from 'lucide-react';

/** Barra superior: menú móvil, búsqueda global (se conecta en su fase), notificaciones y usuario. */
export function Navbar({ onMenuClick }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-surface px-4 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onMenuClick}
        className="rounded-md p-2 text-muted hover:bg-muted-soft lg:hidden"
        aria-label="Abrir menú"
      >
        <Menu className="size-5" />
      </button>

      <div className="relative hidden max-w-md flex-1 sm:block">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          placeholder="Buscar empresas, contactos, clientes…"
          className="w-full rounded-md border border-border bg-background py-2 pr-3 pl-9 text-sm placeholder:text-muted focus:border-primary focus:outline-none"
          aria-label="Búsqueda global"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          className="relative rounded-md p-2 text-muted hover:bg-muted-soft"
          aria-label="Notificaciones"
        >
          <Bell className="size-5" />
        </button>
        <div
          className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary"
          aria-label="Usuario"
        >
          U
        </div>
      </div>
    </header>
  );
}
