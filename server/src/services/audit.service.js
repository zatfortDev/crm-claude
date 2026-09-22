// Registro de auditoría (append-only). Se escribe dentro de la misma transacción que el cambio
// para que log y datos sean consistentes (docs/architecture.md § 3.5).
import { prisma } from '../lib/prisma.js';

const SENSITIVE_FIELDS = new Set(['passwordHash', 'password', 'tokenHash', 'token']);

/** Devuelve solo los campos que cambiaron, sin valores sensibles. */
export function diffChanges(before = {}, after = {}) {
  const changedBefore = {};
  const changedAfter = {};
  for (const key of Object.keys(after)) {
    if (SENSITIVE_FIELDS.has(key)) continue;
    const prev = before[key];
    const next = after[key];
    const equal =
      prev instanceof Date && next instanceof Date
        ? prev.getTime() === next.getTime()
        : prev === next;
    if (!equal) {
      changedBefore[key] = prev ?? null;
      changedAfter[key] = next ?? null;
    }
  }
  if (Object.keys(changedAfter).length === 0) return null;
  return { before: changedBefore, after: changedAfter };
}

/**
 * Escribe una entrada de auditoría.
 * @param {object} client  prisma o el cliente de transacción (tx)
 */
export function logAudit(client, { entityType, entityId, action, changes, userId, ipAddress }) {
  return (client ?? prisma).auditLog.create({
    data: {
      entityType,
      entityId,
      action,
      changes: changes ? JSON.stringify(changes) : null,
      userId: userId ?? null,
      ipAddress: ipAddress ?? null,
    },
  });
}
