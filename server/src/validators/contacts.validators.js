import { z } from 'zod';
import { listQuerySchema } from '../utils/pagination.js';
import { requiredText, optionalText, booleanQuery } from './common.validators.js';

const optionalEmail = z
  .string()
  .trim()
  .max(255)
  .email('Email inválido')
  .optional()
  .or(z.literal(''))
  .transform((value) => (value ? value.toLowerCase() : null));

export const listContactsQuerySchema = listQuerySchema(
  ['createdAt', 'lastName', 'firstName', 'email'],
  'createdAt',
).extend({
  companyId: z.coerce.number().int().positive().optional(),
  jobTitle: z.string().trim().max(100).optional(),
  includeDeleted: booleanQuery,
});

export const contactBodySchema = z
  .object({
    firstName: requiredText(100, 'El nombre'),
    lastName: requiredText(100, 'El apellido'),
    email: optionalEmail,
    phone: optionalText(30),
    mobile: optionalText(30),
    jobTitle: optionalText(100),
    department: optionalText(100),
    linkedinUrl: optionalText(255),
    companyId: z.coerce.number().int().positive().nullable().optional(),
    isPrimary: z.boolean().optional(),
  })
  .strict();
