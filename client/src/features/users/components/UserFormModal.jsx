import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../../../components/ui/Modal.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Select } from '../../../components/ui/Select.jsx';
import { createUserSchema, userFormSchema } from '../../../lib/schemas.js';
import { applyServerErrors } from '../../../api/client.js';
import { useCreateUser, useUpdateUser } from '../hooks/useUsers.js';

const emptyUser = { email: '', firstName: '', lastName: '', phone: '', roleId: '' };

/** Alta y edición de usuarios. En el alta se define una contraseña temporal. */
export function UserFormModal({ open, onClose, user, roles = [] }) {
  const isEdit = Boolean(user);
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(isEdit ? userFormSchema : createUserSchema),
    defaultValues: emptyUser,
  });

  useEffect(() => {
    if (!open) return;
    reset(
      user
        ? {
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone ?? '',
            roleId: user.role?.id ?? '',
          }
        : emptyUser,
    );
  }, [open, user, reset]);

  const onSubmit = async (values) => {
    try {
      if (isEdit) {
        const { roleId: _roleId, ...data } = values;
        await updateUser.mutateAsync({ id: user.id, ...data });
      } else {
        await createUser.mutateAsync(values);
      }
      onClose();
    } catch (error) {
      applyServerErrors(error, setError);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar usuario' : 'Nuevo usuario'}
      description={
        isEdit
          ? 'Actualizá los datos de contacto del usuario.'
          : 'El usuario deberá cambiar la contraseña temporal en su primer acceso.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="user-form" loading={isSubmitting}>
            {isEdit ? 'Guardar cambios' : 'Crear usuario'}
          </Button>
        </>
      }
    >
      <form
        id="user-form"
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
        noValidate
      >
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
        <Input
          label="Email"
          type="email"
          required
          error={errors.email?.message}
          {...register('email')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Teléfono" error={errors.phone?.message} {...register('phone')} />
          {!isEdit && (
            <Select
              label="Rol"
              required
              placeholder="Seleccionar rol"
              error={errors.roleId?.message}
              options={roles.map((role) => ({ value: role.id, label: role.name }))}
              {...register('roleId')}
            />
          )}
        </div>
        {!isEdit && (
          <Input
            label="Contraseña temporal"
            type="text"
            required
            hint="Mínimo 10 caracteres, con mayúscula, minúscula y número. El usuario la cambiará al ingresar."
            error={errors.temporaryPassword?.message}
            {...register('temporaryPassword')}
          />
        )}
        {isEdit && (
          <p className="text-xs text-muted">
            El rol se cambia desde el menú de acciones de la tabla.
          </p>
        )}
      </form>
    </Modal>
  );
}
