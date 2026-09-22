import { z } from 'zod';
import { emailSchema, passwordSchema } from './auth.validators.js';
import { listQuerySchema } from '../utils/pagination.js';
import { requiredText, optionalText, booleanQuery } from './common.validators.js';

export const listUsersQuerySchema = listQuerySchema(
  ['createdAt', 'firstName', 'lastName', 'email', 'lastLoginAt'],
  'createdAt',
).extend({
  roleId: z.coerce.number().int().positive().optional(),
  isActive: booleanQuery,
});

export const createUserSchema = z
  .object({
    email: emailSchema,
    firstName: requiredText(100, 'El nombre'),
    lastName: requiredText(100, 'El apellido'),
    phone: optionalText(30),
    roleId: z.number().int().positive('El rol es obligatorio'),
    temporaryPassword: passwordSchema,
  })
  .strict();

export const updateUserSchema = z
  .object({
    email: emailSchema,
    firstName: requiredText(100, 'El nombre'),
    lastName: requiredText(100, 'El apellido'),
    phone: optionalText(30),
  })
  .strict();

export const setStatusSchema = z.object({ isActive: z.boolean() }).strict();

export const setRoleSchema = z.object({ roleId: z.number().int().positive() }).strict();

export const resetPasswordSchema = z.object({ temporaryPassword: passwordSchema }).strict();
