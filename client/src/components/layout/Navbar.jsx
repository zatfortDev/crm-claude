import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router';
import { Menu, Search, Bell, ChevronDown, User, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { initials } from '../../lib/formatters.js';

/** Menú del usuario: perfil y cierre de sesión. */
function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClickOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const onEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md p-1 pr-2 hover:bg-muted-soft"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
          {initials(user?.firstName, user?.lastName)}
        </span>
        <span className="hidden text-sm font-medium text-foreground sm:block">
          {user?.fullName}
        </span>
        <ChevronDown className="size-4 text-muted" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-md border border-border bg-surface shadow-lg"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-medium text-foreground">{user?.fullName}</p>
            <p className="truncate text-xs text-muted">{user?.email}</p>
            <p className="mt-1 text-xs text-primary">{user?.role?.name}</p>
          </div>
          <Link
            to="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted-soft"
          >
            <User className="size-4" aria-hidden="true" />
            Mi perfil
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={logout}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-danger hover:bg-danger-soft"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

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
          disabled
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
        <UserMenu />
      </div>
    </header>
  );
}
