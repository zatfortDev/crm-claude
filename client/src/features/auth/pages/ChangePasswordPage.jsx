import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext.jsx';
import { changePasswordSchema } from '../../../lib/schemas.js';
import { changePassword } from '../../../api/authApi.js';
import { applyServerErrors } from '../../../api/client.js';
import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';

/** Cambio de contraseña. Obligatorio en el primer acceso (mustChangePassword). */
export function ChangePasswordPage() {
  const { user, clearSession } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(changePasswordSchema) });

  const onSubmit = async ({ currentPassword, newPassword }) => {
    setFormError(null);
    try {
      await changePassword({ currentPassword, newPassword });
      toast.success('Contraseña actualizada. Iniciá sesión nuevamente.');
      // El backend revoca todas las sesiones: se vuelve al login.
      clearSession();
      navigate('/login', { replace: true });
    } catch (error) {
      const apiError = applyServerErrors(error, setError);
      if (!apiError.details) setFormError(apiError.message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <KeyRound className="size-6" aria-hidden="true" />
          </span>
          <h1 className="text-xl font-semibold text-foreground">Cambiá tu contraseña</h1>
          <p className="mt-1 text-sm text-muted">
            {user?.mustChangePassword
              ? 'Por seguridad, definí una contraseña propia antes de continuar.'
              : 'Elegí una contraseña nueva para tu cuenta.'}
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6 shadow-card"
          noValidate
        >
          {formError && (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
              {formError}
            </p>
          )}
          <Input
            label="Contraseña actual"
            type="password"
            autoComplete="current-password"
            required
            error={errors.currentPassword?.message}
            {...register('currentPassword')}
          />
          <Input
            label="Nueva contraseña"
            type="password"
            autoComplete="new-password"
            required
            hint="Mínimo 10 caracteres, con mayúscula, minúscula y número."
            error={errors.newPassword?.message}
            {...register('newPassword')}
          />
          <Input
            label="Repetir nueva contraseña"
            type="password"
            autoComplete="new-password"
            required
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          <Button type="submit" loading={isSubmitting} className="mt-2">
            Guardar contraseña
          </Button>
        </form>
      </div>
    </div>
  );
}
