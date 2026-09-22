import { z } from 'zod';
import { listQuerySchema } from '../utils/pagination.js';
import { requiredText, optionalText, booleanQuery } from './common.validators.js';
import { EMPLOYEES_RANGES } from '../models/constants.js';

const optionalEmail = z
  .string()
  .trim()
  .max(255)
  .email('Email inválido')
  .optional()
  .or(z.literal(''))
  .transform((value) => (value ? value.toLowerCase() : null));

const optionalUrl = z
  .string()
  .trim()
  .max(255)
  .url('URL inválida')
  .optional()
  .or(z.literal(''))
  .transform((value) => (value ? value : null));

export const listCompaniesQuerySchema = listQuerySchema(
  ['createdAt', 'name', 'city', 'industry'],
  'createdAt',
).extend({
  industry: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  employeesRange: z.enum(EMPLOYEES_RANGES).optional(),
  includeDeleted: booleanQuery,
});

export const companyBodySchema = z
  .object({
    name: requiredText(200, 'El nombre'),
    legalName: optionalText(200),
    taxId: optionalText(50),
    industry: optionalText(100),
    website: optionalUrl,
    email: optionalEmail,
    phone: optionalText(30),
    addressLine: optionalText(255),
    city: optionalText(100),
    state: optionalText(100),
    country: optionalText(100),
    postalCode: optionalText(20),
    employeesRange: z
      .enum(EMPLOYEES_RANGES)
      .optional()
      .or(z.literal(''))
      .transform((v) => (v ? v : null)),
    description: optionalText(4000),
  })
  .strict();
