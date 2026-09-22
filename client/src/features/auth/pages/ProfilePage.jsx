import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { KeyRound } from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader.jsx';
import { Card, CardContent } from '../../../components/ui/Card.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { profileSchema } from '../../../lib/schemas.js';
import { updateProfile } from '../../../api/authApi.js';
import { applyServerErrors } from '../../../api/client.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { formatDateTime } from '../../../lib/formatters.js';

export function ProfilePage() {
  const { user, refreshUser } = useAuth();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      phone: user?.phone ?? '',
    },
  });

  const onSubmit = async (values) => {
    try {
      await updateProfile(values);
      await refreshUser();
      toast.success('Perfil actualizado');
    } catch (error) {
      applyServerErrors(error, setError);
    }
  };

  return (
    <>
      <PageHeader title="Mi perfil" description="Actualizá tus datos de contacto." />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Nombre"
                  required
                  error={errors.firstName?.message}
                  {...register('firstName')}
                />
                <Input
                  label="Apellido"
                  required
                  error={errors.lastName?.message}
                  {...register('lastName')}
                />
              </div>
              <Input label="Teléfono" error={errors.phone?.message} {...register('phone')} />
              <Input label="Email" value={user?.email ?? ''} disabled readOnly />
              <p className="text-xs text-muted">
                El email y el rol solo puede cambiarlos un administrador.
              </p>
              <div>
                <Button type="submit" loading={isSubmitting}>
                  Guardar cambios
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-4">
            <div>
              <p className="text-sm text-muted">Rol</p>
              <Badge tone="primary" className="mt-1">
                {user?.role?.name}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted">Último acceso</p>
              <p className="mt-1 text-sm text-foreground">{formatDateTime(user?.lastLoginAt)}</p>
            </div>
            <div>
              <p className="text-sm text-muted">Seguridad</p>
              <Button
                as={Link}
                to="/change-password"
                variant="secondary"
                size="sm"
                className="mt-2"
              >
                <KeyRound className="size-4" aria-hidden="true" />
                Cambiar contraseña
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
