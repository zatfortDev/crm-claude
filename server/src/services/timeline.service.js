// Timeline unificado de una entidad: notas + auditoría (las actividades se suman en su fase).
// Se combinan en memoria porque provienen de tablas distintas y el volumen por entidad es bajo.
import { prisma } from '../lib/prisma.js';

const authorSelect = { select: { id: true, firstName: true, lastName: true } };

function parseChanges(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * @param {string} entityType  'Company' | 'Contact' | ...
 * @param {number} entityId
 * @param {string} noteField   Campo de Note que apunta a la entidad ('companyId', ...)
 */
export async function getTimeline({ entityType, entityId, noteField, page = 1, pageSize = 20 }) {
  const [notes, audits] = await Promise.all([
    prisma.note.findMany({
      where: { [noteField]: entityId },
      include: { author: authorSelect },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.auditLog.findMany({
      where: { entityType, entityId },
      include: { user: authorSelect },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  ]);

  const entries = [
    ...notes.map((note) => ({
      kind: 'note',
      at: note.createdAt,
      actor: note.author,
      payload: { id: note.id, content: note.content, isPinned: note.isPinned },
    })),
    ...audits.map((audit) => ({
      kind: 'audit',
      at: audit.createdAt,
      actor: audit.user,
      payload: { action: audit.action, changes: parseChanges(audit.changes) },
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const start = (page - 1) * pageSize;
  return { items: entries.slice(start, start + pageSize), total: entries.length };
}
