// Normaliza los parámetros de paginación y orden ya validados por Zod.
import { z } from 'zod';

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Esquema Zod reutilizable para listados.
 * @param {string[]} sortable  Columnas permitidas en sortBy (whitelist).
 * @param {string}   defaultSort
 */
export function listQuerySchema(sortable, defaultSort = 'createdAt') {
  return z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    sortBy: z.enum(sortable).default(defaultSort),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    search: z.string().trim().max(200).optional(),
  });
}

/** Convierte page/pageSize en skip/take y sortBy/sortOrder en orderBy de Prisma. */
export function toPrismaPagination({ page, pageSize, sortBy, sortOrder }) {
  return {
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: { [sortBy]: sortOrder },
  };
}
