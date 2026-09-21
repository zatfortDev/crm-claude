import { NavLink } from 'react-router';
import {
  LayoutDashboard,
  Building2,
  Users,
  UserCircle,
  Target,
  Briefcase,
  CalendarCheck,
  BarChart3,
  Settings,
  X,
} from 'lucide-react';
import { APP_NAME } from '../../lib/constants.js';
import { cn } from '../../lib/utils.js';

export const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/companies', label: 'Empresas', icon: Building2 },
  { to: '/contacts', label: 'Contactos', icon: Users },
  { to: '/clients', label: 'Clientes', icon: UserCircle },
  { to: '/leads', label: 'Leads', icon: Target },
  { to: '/opportunities', label: 'Oportunidades', icon: Briefcase },
  { to: '/activities', label: 'Actividades', icon: CalendarCheck },
  { to: '/reports', label: 'Reportes', icon: BarChart3 },
  { to: '/settings', label: 'Configuración', icon: Settings },
];

function NavItems({ onNavigate }) {
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Principal">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-sidebar-active text-white'
                : 'text-sidebar-foreground hover:bg-sidebar-active/60 hover:text-white',
            )
          }
        >
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex h-16 items-center gap-2 px-6 text-white">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold">
        {APP_NAME.slice(0, 1)}
      </span>
      <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
    </div>
  );
}

export function Sidebar({ mobileOpen, onClose }) {
  return (
    <>
      {/* Escritorio */}
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar lg:flex">
        <Brand />
        <NavItems />
      </aside>

      {/* Móvil */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-sidebar shadow-xl">
            <div className="flex items-center justify-between pr-3">
              <Brand />
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-2 text-sidebar-foreground hover:bg-sidebar-active hover:text-white"
                aria-label="Cerrar menú"
              >
                <X className="size-5" />
              </button>
            </div>
            <NavItems onNavigate={onClose} />
          </aside>
        </div>
      )}
    </>
  );
}
