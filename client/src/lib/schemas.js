// Esquemas de formularios (espejo de las validaciones del backend).
// El servidor vuelve a validar siempre: esto solo mejora la experiencia de uso.
import { z } from 'zod';

export const emailField = z
  .string()
  .trim()
  .min(1, 'El email es obligatorio')
  .email('Email inválido');

export const passwordField = z
  .string()
  .min(10, 'La contraseña debe tener al menos 10 caracteres')
  .regex(/[a-z]/, 'Debe incluir una minúscula')
  .regex(/[A-Z]/, 'Debe incluir una mayúscula')
  .regex(/\d/, 'Debe incluir un número');

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'La contraseña actual es obligatoria'),
    newPassword: passwordField,
    confirmPassword: z.string().min(1, 'Repetí la nueva contraseña'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden',
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    path: ['newPassword'],
    message: 'La nueva contraseña debe ser distinta de la actual',
  });

export const userFormSchema = z.object({
  email: emailField,
  firstName: z.string().trim().min(1, 'El nombre es obligatorio').max(100),
  lastName: z.string().trim().min(1, 'El apellido es obligatorio').max(100),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  roleId: z.coerce.number().int().positive('Seleccioná un rol'),
});

export const createUserSchema = userFormSchema.extend({ temporaryPassword: passwordField });

export const profileSchema = z.object({
  firstName: z.string().trim().min(1, 'El nombre es obligatorio').max(100),
  lastName: z.string().trim().min(1, 'El apellido es obligatorio').max(100),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
});

const optionalString = (max) => z.string().trim().max(max).optional().or(z.literal(''));

export const EMPLOYEES_RANGES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];

export const companySchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(200),
  legalName: optionalString(200),
  taxId: optionalString(50),
  industry: optionalString(100),
  website: z.string().trim().url('URL inválida').max(255).optional().or(z.literal('')),
  email: z.string().trim().email('Email inválido').max(255).optional().or(z.literal('')),
  phone: optionalString(30),
  addressLine: optionalString(255),
  city: optionalString(100),
  state: optionalString(100),
  country: optionalString(100),
  postalCode: optionalString(20),
  employeesRange: z.enum(EMPLOYEES_RANGES).optional().or(z.literal('')),
  description: optionalString(4000),
});

export const contactSchema = z.object({
  firstName: z.string().trim().min(1, 'El nombre es obligatorio').max(100),
  lastName: z.string().trim().min(1, 'El apellido es obligatorio').max(100),
  email: z.string().trim().email('Email inválido').max(255).optional().or(z.literal('')),
  phone: optionalString(30),
  mobile: optionalString(30),
  jobTitle: optionalString(100),
  department: optionalString(100),
  linkedinUrl: optionalString(255),
  companyId: z.union([z.coerce.number().int().positive(), z.literal('')]).optional(),
  isPrimary: z.boolean().optional(),
});
