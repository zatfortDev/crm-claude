import { Navigate, useLocation } from 'react-router';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext.jsx';
import { EmptyState } from '../../../components/common/EmptyState.jsx';

/**
 * Protege una ruta: exige sesión, fuerza el cambio de contraseña pendiente y,
 * opcionalmente, un permiso. La autorización real la aplica el backend.
 */
export function ProtectedRoute({ permission, children }) {
  const { isAuthenticated, isLoading, user, hasPermission } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="size-6 animate-spin text-muted" aria-hidden="true" />
        <span className="sr-only">Cargando sesión…</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (user?.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  if (permission && !hasPermission(permission)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="No tenés acceso a esta sección"
        description="Si creés que es un error, pedile a un administrador que revise tus permisos."
      />
    );
  }

  return children;
}
