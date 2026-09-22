import { z } from 'zod';
import { requiredText, optionalText } from './common.validators.js';

const permissionsSchema = z
  .array(z.string().trim().max(100))
  .min(1, 'Seleccioná al menos un permiso')
  .max(200)
  // Evita duplicados que romperían la clave compuesta de RolePermission.
  .transform((codes) => [...new Set(codes)]);

export const roleBodySchema = z
  .object({
    name: requiredText(50, 'El nombre del rol'),
    description: optionalText(255),
    permissions: permissionsSchema,
  })
  .strict();
