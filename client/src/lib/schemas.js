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
