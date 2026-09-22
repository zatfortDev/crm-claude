import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '../../../components/ui/Modal.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { passwordField } from '../../../lib/schemas.js';
import { applyServerErrors } from '../../../api/client.js';
import { useResetUserPassword } from '../hooks/useUsers.js';

const schema = z.object({ temporaryPassword: passwordField });

/** Asigna una contraseña temporal: cierra las sesiones del usuario y fuerza el cambio. */
export function ResetPasswordModal({ open, onClose, user }) {
  const resetPassword = useResetUserPassword();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { temporaryPassword: '' } });

  useEffect(() => {
    if (open) reset({ temporaryPassword: '' });
  }, [open, reset]);

  const onSubmit = async ({ temporaryPassword }) => {
    try {
      await resetPassword.mutateAsync({ id: user.id, temporaryPassword });
      onClose();
    } catch (error) {
      applyServerErrors(error, setError);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Resetear contraseña"
      description={`Se cerrarán las sesiones de ${user?.fullName ?? ''} y deberá definir una nueva contraseña al ingresar.`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="reset-password-form" loading={isSubmitting}>
            Asignar contraseña
          </Button>
        </>
      }
    >
      <form id="reset-password-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Input
          label="Contraseña temporal"
          type="text"
          required
          hint="Comunicásela al usuario por un canal seguro."
          error={errors.temporaryPassword?.message}
          {...register('temporaryPassword')}
        />
      </form>
    </Modal>
  );
}
