import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../../../components/ui/Modal.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Select } from '../../../components/ui/Select.jsx';
import { Textarea } from '../../../components/ui/Textarea.jsx';
import { companySchema, EMPLOYEES_RANGES } from '../../../lib/schemas.js';
import { applyServerErrors } from '../../../api/client.js';
import { useCreateCompany, useUpdateCompany } from '../hooks/useCompanies.js';

const emptyCompany = {
  name: '',
  legalName: '',
  taxId: '',
  industry: '',
  website: '',
  email: '',
  phone: '',
  addressLine: '',
  city: '',
  state: '',
  country: '',
  postalCode: '',
  employeesRange: '',
  description: '',
};

/** Alta y edición de empresas. */
export function CompanyFormModal({ open, onClose, company, onCreated }) {
  const isEdit = Boolean(company);
  const createCompany = useCreateCompany();
  const updateCompany = useUpdateCompany();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(companySchema), defaultValues: emptyCompany });

  useEffect(() => {
    if (!open) return;
    reset(
      company
        ? Object.fromEntries(Object.keys(emptyCompany).map((key) => [key, company[key] ?? '']))
        : emptyCompany,
    );
  }, [open, company, reset]);

  const onSubmit = async (values) => {
    try {
      const saved = isEdit
        ? await updateCompany.mutateAsync({ id: company.id, ...values })
        : await createCompany.mutateAsync(values);
      onClose();
      onCreated?.(saved);
    } catch (error) {
      applyServerErrors(error, setError);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar empresa' : 'Nueva empresa'}
      description="Solo el nombre es obligatorio; el resto ayuda a segmentar y buscar."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="company-form" loading={isSubmitting}>
            {isEdit ? 'Guardar cambios' : 'Crear empresa'}
          </Button>
        </>
      }
    >
      <form
        id="company-form"
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
        noValidate
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Nombre" required error={errors.name?.message} {...register('name')} />
          <Input
            label="Razón social"
            error={errors.legalName?.message}
            {...register('legalName')}
          />
          <Input
            label="Identificador fiscal"
            hint="CUIT, NIF, RFC…"
            error={errors.taxId?.message}
            {...register('taxId')}
          />
          <Input label="Industria" error={errors.industry?.message} {...register('industry')} />
          <Input
            label="Sitio web"
            placeholder="https://…"
            error={errors.website?.message}
            {...register('website')}
          />
          <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
          <Input label="Teléfono" error={errors.phone?.message} {...register('phone')} />
          <Select
            label="Tamaño"
            placeholder="Sin especificar"
            error={errors.employeesRange?.message}
            options={EMPLOYEES_RANGES.map((range) => ({
              value: range,
              label: `${range} empleados`,
            }))}
            {...register('employeesRange')}
          />
        </div>

        <Input label="Dirección" error={errors.addressLine?.message} {...register('addressLine')} />
        <div className="grid gap-4 sm:grid-cols-4">
          <Input label="Ciudad" error={errors.city?.message} {...register('city')} />
          <Input label="Provincia" error={errors.state?.message} {...register('state')} />
          <Input label="País" error={errors.country?.message} {...register('country')} />
          <Input
            label="Código postal"
            error={errors.postalCode?.message}
            {...register('postalCode')}
          />
        </div>

        <Textarea
          label="Descripción"
          rows={3}
          error={errors.description?.message}
          {...register('description')}
        />
      </form>
    </Modal>
  );
}
