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
  ShieldCheck,
  X,
} from 'lucide-react';
import { APP_NAME } from '../../lib/constants.js';
import { cn } from '../../lib/utils.js';
import { useAuth } from '../../context/AuthContext.jsx';

/** Navegación principal. Cada entrada declara el permiso que la habilita. */
export const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard:view' },
  { to: '/companies', label: 'Empresas', icon: Building2, permission: 'companies:read' },
  { to: '/contacts', label: 'Contactos', icon: Users, permission: 'contacts:read' },
  { to: '/clients', label: 'Clientes', icon: UserCircle, permission: 'clients:read' },
  { to: '/leads', label: 'Leads', icon: Target, permission: 'leads:read' },
  {
    to: '/opportunities',
    label: 'Oportunidades',
    icon: Briefcase,
    permission: 'opportunities:read',
  },
  { to: '/activities', label: 'Actividades', icon: CalendarCheck, permission: 'activities:read' },
  { to: '/reports', label: 'Reportes', icon: BarChart3, permission: 'reports:view' },
  { to: '/users', label: 'Usuarios', icon: ShieldCheck, permission: 'users:read' },
  { to: '/settings', label: 'Configuración', icon: Settings, permission: 'settings:read' },
];

function NavItems({ items, onNavigate }) {
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 pb-4" aria-label="Principal">
      {items.map(({ to, label, icon: Icon }) => (
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
  const { hasPermission } = useAuth();
  const items = NAV_ITEMS.filter((item) => !item.permission || hasPermission(item.permission));

  return (
    <>
      {/* Escritorio */}
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar lg:flex">
        <Brand />
        <NavItems items={items} />
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
            <NavItems items={items} onNavigate={onClose} />
          </aside>
        </div>
      )}
    </>
  );
}
