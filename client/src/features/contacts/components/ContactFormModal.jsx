import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../../../components/ui/Modal.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Select } from '../../../components/ui/Select.jsx';
import { contactSchema } from '../../../lib/schemas.js';
import { applyServerErrors } from '../../../api/client.js';
import { useCreateContact, useUpdateContact } from '../hooks/useContacts.js';
import { useCompanies } from '../../companies/hooks/useCompanies.js';

const emptyContact = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  mobile: '',
  jobTitle: '',
  department: '',
  linkedinUrl: '',
  companyId: '',
  isPrimary: false,
};

/** Alta y edición de contactos. `lockedCompanyId` fija la empresa (alta desde su detalle). */
export function ContactFormModal({ open, onClose, contact, lockedCompanyId, onSaved }) {
  const isEdit = Boolean(contact);
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  // Selector de empresas: el listado inicial alcanza para el uso habitual.
  const { data: companies } = useCompanies({
    page: 1,
    pageSize: 100,
    sortBy: 'name',
    sortOrder: 'asc',
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(contactSchema), defaultValues: emptyContact });

  useEffect(() => {
    if (!open) return;
    reset(
      contact
        ? {
            ...Object.fromEntries(
              Object.keys(emptyContact).map((key) => [key, contact[key] ?? '']),
            ),
            companyId: contact.company?.id ?? '',
            isPrimary: Boolean(contact.isPrimary),
          }
        : { ...emptyContact, companyId: lockedCompanyId ?? '' },
    );
  }, [open, contact, lockedCompanyId, reset]);

  const onSubmit = async (values) => {
    const payload = {
      ...values,
      companyId: values.companyId === '' ? null : Number(values.companyId),
      isPrimary: Boolean(values.isPrimary),
    };
    try {
      const saved = isEdit
        ? await updateContact.mutateAsync({ id: contact.id, ...payload })
        : await createContact.mutateAsync(payload);
      onClose();
      onSaved?.(saved);
    } catch (error) {
      applyServerErrors(error, setError);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar contacto' : 'Nuevo contacto'}
      description="Nombre y apellido son obligatorios. El email debe ser único."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="contact-form" loading={isSubmitting}>
            {isEdit ? 'Guardar cambios' : 'Crear contacto'}
          </Button>
        </>
      }
    >
      <form
        id="contact-form"
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
          <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
          <Input label="Teléfono" error={errors.phone?.message} {...register('phone')} />
          <Input label="Móvil" error={errors.mobile?.message} {...register('mobile')} />
          <Input label="Cargo" error={errors.jobTitle?.message} {...register('jobTitle')} />
          <Input label="Área" error={errors.department?.message} {...register('department')} />
          <Input
            label="LinkedIn"
            error={errors.linkedinUrl?.message}
            {...register('linkedinUrl')}
          />
        </div>

        {!lockedCompanyId && (
          <Select
            label="Empresa"
            placeholder="Sin empresa"
            error={errors.companyId?.message}
            options={(companies?.items ?? []).map((company) => ({
              value: company.id,
              label: company.name,
            }))}
            {...register('companyId')}
          />
        )}

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            className="size-4 rounded border-border text-primary focus:ring-primary/30"
            {...register('isPrimary')}
          />
          Marcar como contacto principal de la empresa
        </label>
      </form>
    </Modal>
  );
}
