import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LogIn } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext.jsx';
import { loginSchema } from '../../../lib/schemas.js';
import { toApiError } from '../../../api/client.js';
import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { APP_NAME } from '../../../lib/constants.js';

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  if (isAuthenticated) return <Navigate to={location.state?.from ?? '/dashboard'} replace />;

  const onSubmit = async (values) => {
    setFormError(null);
    try {
      const user = await login(values);
      const destination = user.mustChangePassword
        ? '/change-password'
        : (location.state?.from ?? '/dashboard');
      navigate(destination, { replace: true });
    } catch (error) {
      setFormError(toApiError(error).message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
            {APP_NAME.slice(0, 1)}
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{APP_NAME}</h1>
          <p className="mt-1 text-sm text-muted">Iniciá sesión para continuar</p>
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
            label="Email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            required
            error={errors.password?.message}
            {...register('password')}
          />

          <Button type="submit" loading={isSubmitting} className="mt-2">
            <LogIn className="size-4" aria-hidden="true" />
            Ingresar
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          Si olvidaste tu contraseña, contactá a un administrador.
        </p>
      </div>
    </div>
  );
}
