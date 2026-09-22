import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'El email es obligatorio')
  .max(255, 'El email es demasiado largo')
  .email('Email inválido')
  .toLowerCase();

/** Política de contraseñas: ≥ 10 caracteres con mayúscula, minúscula y número. */
export const passwordSchema = z
  .string()
  .min(10, 'La contraseña debe tener al menos 10 caracteres')
  .max(128, 'La contraseña es demasiado larga')
  .regex(/[a-z]/, 'La contraseña debe incluir una minúscula')
  .regex(/[A-Z]/, 'La contraseña debe incluir una mayúscula')
  .regex(/\d/, 'La contraseña debe incluir un número');

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, 'La contraseña es obligatoria').max(128),
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'La contraseña actual es obligatoria').max(128),
    newPassword: passwordSchema,
  })
  .strict()
  .refine((data) => data.currentPassword !== data.newPassword, {
    path: ['newPassword'],
    message: 'La nueva contraseña debe ser distinta de la actual',
  });

export const updateProfileSchema = z
  .object({
    firstName: z.string().trim().min(1, 'El nombre es obligatorio').max(100),
    lastName: z.string().trim().min(1, 'El apellido es obligatorio').max(100),
    phone: z
      .string()
      .trim()
      .max(30)
      .optional()
      .or(z.literal(''))
      .transform((v) => (v ? v : null)),
  })
  .strict();
