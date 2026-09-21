import { Link } from 'react-router';
import { Compass } from 'lucide-react';
import { EmptyState } from './EmptyState.jsx';
import { Button } from '../ui/Button.jsx';

export function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      title="Página no encontrada"
      description="La ruta que intentaste abrir no existe o fue movida."
      action={
        <Button as={Link} to="/dashboard" variant="secondary">
          Ir al dashboard
        </Button>
      }
    />
  );
}
