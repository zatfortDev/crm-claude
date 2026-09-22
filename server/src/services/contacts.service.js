// Contactos: personas, opcionalmente asociadas a una empresa. Directorio compartido.
// Solo puede haber un contacto principal por empresa; no se archiva el contacto
// principal de un cliente activo (docs/database.md § 6, I-07).
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { toPrismaPagination } from '../utils/pagination.js';
import { logAudit, diffChanges } from './audit.service.js';
import { AUDIT_ACTION } from '../models/constants.js';

const include = {
  company: { select: { id: true, name: true, deletedAt: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
};

const EDITABLE_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'mobile',
  'jobTitle',
  'department',
  'linkedinUrl',
];

function serialize(contact) {
  return {
    id: contact.id,
    firstName: contact.firstName,
    lastName: contact.lastName,
    fullName: `${contact.firstName} ${contact.lastName}`,
    email: contact.email,
    phone: contact.phone,
    mobile: contact.mobile,
    jobTitle: contact.jobTitle,
    department: contact.department,
    linkedinUrl: contact.linkedinUrl,
    isPrimary: contact.isPrimary,
    isArchived: Boolean(contact.deletedAt),
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
    company: contact.company ? { id: contact.company.id, name: contact.company.name } : null,
    createdBy: contact.createdBy ?? null,
  };
}

async function findOrFail(id, { includeDeleted = false } = {}) {
  const contact = await prisma.contact.findUnique({ where: { id } });
  if (!contact || (!includeDeleted && contact.deletedAt)) {
    throw ApiError.notFound('Contacto no encontrado');
  }
  return contact;
}

/** Valida que la empresa exista y esté activa. */
async function assertCompanyExists(client, companyId) {
  if (!companyId) return;
  const company = await client.company.findFirst({
    where: { id: companyId, deletedAt: null },
    select: { id: true },
  });
  if (!company) {
    throw ApiError.validation([{ field: 'companyId', message: 'La empresa indicada no existe' }]);
  }
}

/** Deja un único contacto principal por empresa. */
async function clearOtherPrimaries(client, companyId, exceptId) {
  if (!companyId) return;
  await client.contact.updateMany({
    where: { companyId, isPrimary: true, ...(exceptId ? { id: { not: exceptId } } : {}) },
    data: { isPrimary: false },
  });
}

export async function list({
  page,
  pageSize,
  sortBy,
  sortOrder,
  search,
  companyId,
  jobTitle,
  includeDeleted = false,
}) {
  const where = {
    ...(includeDeleted ? {} : { deletedAt: null }),
    ...(companyId ? { companyId } : {}),
    ...(jobTitle ? { jobTitle: { contains: jobTitle } } : {}),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search } },
            { lastName: { contains: search } },
            { email: { contains: search } },
            { phone: { contains: search } },
            { mobile: { contains: search } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      include,
      ...toPrismaPagination({ page, pageSize, sortBy, sortOrder }),
    }),
    prisma.contact.count({ where }),
  ]);
  return { items: items.map(serialize), total };
}

export async function getById(id, { includeDeleted = false } = {}) {
  const contact = await prisma.contact.findUnique({ where: { id }, include });
  if (!contact || (!includeDeleted && contact.deletedAt)) {
    throw ApiError.notFound('Contacto no encontrado');
  }
  return serialize(contact);
}

export async function create({ data, actor, ipAddress }) {
  if (data.email) {
    const duplicated = await prisma.contact.findFirst({
      where: { email: data.email, deletedAt: null },
    });
    if (duplicated) throw ApiError.conflict('Ya existe un contacto con ese email');
  }

  const contact = await prisma.$transaction(async (tx) => {
    await assertCompanyExists(tx, data.companyId);
    const isPrimary = Boolean(data.isPrimary && data.companyId);
    if (isPrimary) await clearOtherPrimaries(tx, data.companyId);

    const created = await tx.contact.create({
      data: { ...data, isPrimary, createdById: actor.id },
      include,
    });
    await logAudit(tx, {
      entityType: 'Contact',
      entityId: created.id,
      action: AUDIT_ACTION.CREATE,
      changes: { after: { fullName: `${created.firstName} ${created.lastName}` } },
      userId: actor.id,
      ipAddress,
    });
    return created;
  });
  return serialize(contact);
}

export async function update({ id, data, actor, ipAddress }) {
  const current = await findOrFail(id);

  if (data.email && data.email !== current.email) {
    const duplicated = await prisma.contact.findFirst({
      where: { email: data.email, deletedAt: null, id: { not: id } },
    });
    if (duplicated) throw ApiError.conflict('Ya existe un contacto con ese email');
  }

  const contact = await prisma.$transaction(async (tx) => {
    await assertCompanyExists(tx, data.companyId);

    // Cambiar de empresa hace que deje de ser principal de la anterior.
    const companyChanged = (data.companyId ?? null) !== current.companyId;
    const isPrimary = Boolean(data.isPrimary && data.companyId);
    if (isPrimary) await clearOtherPrimaries(tx, data.companyId, id);

    const updated = await tx.contact.update({
      where: { id },
      data: {
        ...Object.fromEntries(EDITABLE_FIELDS.map((field) => [field, data[field] ?? null])),
        companyId: data.companyId ?? null,
        isPrimary: companyChanged && !isPrimary ? false : isPrimary,
      },
      include,
    });
    const changes = diffChanges(current, updated);
    if (changes) {
      await logAudit(tx, {
        entityType: 'Contact',
        entityId: id,
        action: AUDIT_ACTION.UPDATE,
        changes,
        userId: actor.id,
        ipAddress,
      });
    }
    return updated;
  });
  return serialize(contact);
}

export async function archive({ id, actor, ipAddress }) {
  return prisma.$transaction(async (tx) => {
    const contact = await tx.contact.findUnique({ where: { id } });
    if (!contact || contact.deletedAt) throw ApiError.notFound('Contacto no encontrado');

    const primaryOfActiveClient = await tx.client.findFirst({
      where: { primaryContactId: id, deletedAt: null, status: 'ACTIVE' },
      select: { id: true },
    });
    if (primaryOfActiveClient) {
      throw ApiError.businessRule(
        'CONTACT_IS_PRIMARY_OF_CLIENT',
        'No se puede archivar el contacto principal de un cliente activo',
      );
    }

    const archived = await tx.contact.update({
      where: { id },
      data: { deletedAt: new Date(), isPrimary: false },
      include,
    });
    await logAudit(tx, {
      entityType: 'Contact',
      entityId: id,
      action: AUDIT_ACTION.DELETE,
      userId: actor.id,
      ipAddress,
    });
    return serialize(archived);
  });
}

export async function restore({ id, actor, ipAddress }) {
  const contact = await findOrFail(id, { includeDeleted: true });
  if (!contact.deletedAt) return serialize(await getById(id));

  if (contact.email) {
    const duplicated = await prisma.contact.findFirst({
      where: { email: contact.email, deletedAt: null, id: { not: id } },
    });
    if (duplicated) throw ApiError.conflict('Otro contacto activo ya usa ese email');
  }

  const restored = await prisma.$transaction(async (tx) => {
    const result = await tx.contact.update({
      where: { id },
      data: { deletedAt: null },
      include,
    });
    await logAudit(tx, {
      entityType: 'Contact',
      entityId: id,
      action: AUDIT_ACTION.RESTORE,
      userId: actor.id,
      ipAddress,
    });
    return result;
  });
  return serialize(restored);
}

export { findOrFail as findContactOrFail, serialize as serializeContact };
