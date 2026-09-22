import { z } from 'zod';

/** Parámetro :id de la URL. */
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive('Identificador inválido'),
});

/** Texto obligatorio con longitud máxima. */
export const requiredText = (max, field = 'Este campo') =>
  z.string().trim().min(1, `${field} es obligatorio`).max(max, `${field} es demasiado largo`);

/** Texto opcional: '' se normaliza a null. */
export const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(''))
    .transform((value) => (value ? value : null));

/** Booleano recibido por query string ('true'/'false'). */
export const booleanQuery = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === 'true'));
