// Resolución de permisos efectivos por rol, con caché en memoria de vida corta.
// La autoridad es siempre la base: el JWT no transporta permisos (docs/security.md § 4.3).
import { prisma } from '../lib/prisma.js';

const CACHE_TTL_MS = 60_000;
const cache = new Map(); // roleId -> { permissions: string[], expiresAt: number }

/** Devuelve los códigos de permiso del rol. */
export async function getRolePermissions(roleId) {
  const cached = cache.get(roleId);
  if (cached && cached.expiresAt > Date.now()) return cached.permissions;

  const rows = await prisma.rolePermission.findMany({
    where: { roleId },
    select: { permission: { select: { code: true } } },
  });
  const permissions = rows.map((row) => row.permission.code);
  cache.set(roleId, { permissions, expiresAt: Date.now() + CACHE_TTL_MS });
  return permissions;
}

/** Invalida la caché (al modificar un rol o sus permisos). */
export function invalidatePermissionCache(roleId) {
  if (roleId === undefined) cache.clear();
  else cache.delete(roleId);
}
