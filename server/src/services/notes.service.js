// Notas asociadas a una entidad (empresa, contacto, cliente, lead u oportunidad).
// Cada nota tiene exactamente un padre (CK_Note_single_parent en la base).
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { can } from '../middleware/authorize.js';
import { toPublicUser } from '../utils/serializers.js';

export const NOTE_PARENTS = ['companyId', 'contactId', 'clientId', 'leadId', 'opportunityId'];

const authorSelect = {
  author: { select: { id: true, firstName: true, lastName: true } },
};

function serialize(note) {
  return {
    id: note.id,
    content: note.content,
    isPinned: note.isPinned,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    author: note.author
      ? { id: note.author.id, firstName: note.author.firstName, lastName: note.author.lastName }
      : null,
    parent: NOTE_PARENTS.reduce(
      (acc, key) => (note[key] ? { type: key, id: note[key] } : acc),
      null,
    ),
  };
}

/** Notas de una entidad, con las fijadas primero. */
export async function listByParent(parentField, parentId) {
  const notes = await prisma.note.findMany({
    where: { [parentField]: parentId },
    include: authorSelect,
    orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
  });
  return notes.map(serialize);
}

export async function create({ data, actor }) {
  const parents = NOTE_PARENTS.filter((key) => data[key]);
  if (parents.length !== 1) {
    throw ApiError.validation([
      { field: 'parent', message: 'La nota debe asociarse exactamente a una entidad' },
    ]);
  }

  const note = await prisma.note.create({
    data: {
      content: data.content,
      isPinned: data.isPinned ?? false,
      authorId: actor.id,
      ...Object.fromEntries(parents.map((key) => [key, data[key]])),
    },
    include: authorSelect,
  });
  return serialize(note);
}

/** El autor edita sus notas; `notes:manage` permite editar las ajenas. */
export async function update({ id, data, actor }) {
  const current = await prisma.note.findUnique({ where: { id } });
  if (!current) throw ApiError.notFound('Nota no encontrada');
  if (current.authorId !== actor.id && !can(actor, 'notes:manage')) {
    throw ApiError.forbidden('Solo podés editar tus propias notas');
  }

  const note = await prisma.note.update({
    where: { id },
    data: { content: data.content, isPinned: data.isPinned ?? current.isPinned },
    include: authorSelect,
  });
  return serialize(note);
}

export async function remove({ id, actor }) {
  const current = await prisma.note.findUnique({ where: { id } });
  if (!current) throw ApiError.notFound('Nota no encontrada');
  if (current.authorId !== actor.id && !can(actor, 'notes:manage')) {
    throw ApiError.forbidden('Solo podés eliminar tus propias notas');
  }
  await prisma.note.delete({ where: { id } });
}

export { serialize as serializeNote, toPublicUser };
