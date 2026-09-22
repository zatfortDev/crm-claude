// Empresas: directorio compartido (sin responsable). Borrado lógico con reglas
// de integridad: no se archiva una empresa con cliente activo u oportunidades abiertas.
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { toPrismaPagination } from '../utils/pagination.js';
import { logAudit, diffChanges } from './audit.service.js';
import { AUDIT_ACTION } from '../models/constants.js';

const createdBySelect = {
  createdBy: { select: { id: true, firstName: true, lastName: true } },
};

const EDITABLE_FIELDS = [
  'name',
  'legalName',
  'taxId',
  'industry',
  'website',
  'email',
  'phone',
  'addressLine',
  'city',
  'state',
  'country',
  'postalCode',
  'employeesRange',
  'description',
];

function serialize(company) {
  return {
    id: company.id,
    name: company.name,
    legalName: company.legalName,
    taxId: company.taxId,
    industry: company.industry,
    website: company.website,
    email: company.email,
    phone: company.phone,
    addressLine: company.addressLine,
    city: company.city,
    state: company.state,
    country: company.country,
    postalCode: company.postalCode,
    employeesRange: company.employeesRange,
    description: company.description,
    isArchived: Boolean(company.deletedAt),
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
    createdBy: company.createdBy ?? null,
    contactsCount: company._count?.contacts,
    isClient: company.client ? true : undefined,
    client: company.client
      ? { id: company.client.id, status: company.client.status, ownerId: company.client.ownerId }
      : null,
  };
}

/** Empresa existente y no archivada (salvo que se pidan las archivadas). */
async function findOrFail(id, { includeDeleted = false } = {}) {
  const company = await prisma.company.findUnique({ where: { id } });
  if (!company || (!includeDeleted && company.deletedAt)) {
    throw ApiError.notFound('Empresa no encontrada');
  }
  return company;
}

export async function list({
  page,
  pageSize,
  sortBy,
  sortOrder,
  search,
  industry,
  city,
  country,
  employeesRange,
  includeDeleted = false,
}) {
  const where = {
    ...(includeDeleted ? {} : { deletedAt: null }),
    ...(industry ? { industry } : {}),
    ...(city ? { city } : {}),
    ...(country ? { country } : {}),
    ...(employeesRange ? { employeesRange } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { legalName: { contains: search } },
            { taxId: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.company.findMany({
      where,
      include: { ...createdBySelect, _count: { select: { contacts: true } } },
      ...toPrismaPagination({ page, pageSize, sortBy, sortOrder }),
    }),
    prisma.company.count({ where }),
  ]);
  return { items: items.map(serialize), total };
}

export async function getById(id, { includeDeleted = false } = {}) {
  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      ...createdBySelect,
      client: { select: { id: true, status: true, ownerId: true, deletedAt: true } },
      _count: { select: { contacts: true } },
    },
  });
  if (!company || (!includeDeleted && company.deletedAt)) {
    throw ApiError.notFound('Empresa no encontrada');
  }
  // Un cliente archivado no cuenta como vínculo vigente.
  if (company.client?.deletedAt) company.client = null;
  return serialize(company);
}

export async function create({ data, actor, ipAddress }) {
  if (data.taxId) {
    const duplicated = await prisma.company.findFirst({
      where: { taxId: data.taxId, deletedAt: null },
    });
    if (duplicated) throw ApiError.conflict('Ya existe una empresa con ese identificador fiscal');
  }

  const company = await prisma.$transaction(async (tx) => {
    const created = await tx.company.create({
      data: { ...data, createdById: actor.id },
      include: createdBySelect,
    });
    await logAudit(tx, {
      entityType: 'Company',
      entityId: created.id,
      action: AUDIT_ACTION.CREATE,
      changes: { after: { name: created.name } },
      userId: actor.id,
      ipAddress,
    });
    return created;
  });
  return serialize(company);
}

export async function update({ id, data, actor, ipAddress }) {
  const current = await findOrFail(id);

  if (data.taxId && data.taxId !== current.taxId) {
    const duplicated = await prisma.company.findFirst({
      where: { taxId: data.taxId, deletedAt: null, id: { not: id } },
    });
    if (duplicated) throw ApiError.conflict('Ya existe una empresa con ese identificador fiscal');
  }

  const company = await prisma.$transaction(async (tx) => {
    const updated = await tx.company.update({
      where: { id },
      data: Object.fromEntries(EDITABLE_FIELDS.map((field) => [field, data[field] ?? null])),
      include: createdBySelect,
    });
    const changes = diffChanges(current, updated);
    if (changes) {
      await logAudit(tx, {
        entityType: 'Company',
        entityId: id,
        action: AUDIT_ACTION.UPDATE,
        changes,
        userId: actor.id,
        ipAddress,
      });
    }
    return updated;
  });
  return serialize(company);
}

/** Archiva (soft delete) verificando que no queden vínculos comerciales vigentes. */
export async function archive({ id, actor, ipAddress }) {
  return prisma.$transaction(async (tx) => {
    const company = await tx.company.findUnique({ where: { id } });
    if (!company || company.deletedAt) throw ApiError.notFound('Empresa no encontrada');

    const activeClient = await tx.client.findFirst({
      where: { companyId: id, deletedAt: null, status: 'ACTIVE' },
      select: { id: true },
    });
    if (activeClient) {
      throw ApiError.businessRule(
        'COMPANY_HAS_ACTIVE_CLIENT',
        'No se puede archivar una empresa con un cliente activo',
      );
    }

    const openOpportunities = await tx.opportunity.count({
      where: {
        deletedAt: null,
        client: { companyId: id },
        stage: { isWon: false, isLost: false },
      },
    });
    if (openOpportunities > 0) {
      throw ApiError.businessRule(
        'COMPANY_HAS_OPEN_OPPORTUNITIES',
        'No se puede archivar una empresa con oportunidades abiertas',
      );
    }

    const archived = await tx.company.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: createdBySelect,
    });
    await logAudit(tx, {
      entityType: 'Company',
      entityId: id,
      action: AUDIT_ACTION.DELETE,
      userId: actor.id,
      ipAddress,
    });
    return serialize(archived);
  });
}

export async function restore({ id, actor, ipAddress }) {
  const company = await findOrFail(id, { includeDeleted: true });
  if (!company.deletedAt) return serialize(company);

  // Si mientras estuvo archivada otra empresa tomó su identificador fiscal, no se restaura.
  if (company.taxId) {
    const duplicated = await prisma.company.findFirst({
      where: { taxId: company.taxId, deletedAt: null, id: { not: id } },
    });
    if (duplicated) {
      throw ApiError.conflict('Otra empresa activa ya usa ese identificador fiscal');
    }
  }

  const restored = await prisma.$transaction(async (tx) => {
    const result = await tx.company.update({
      where: { id },
      data: { deletedAt: null },
      include: createdBySelect,
    });
    await logAudit(tx, {
      entityType: 'Company',
      entityId: id,
      action: AUDIT_ACTION.RESTORE,
      userId: actor.id,
      ipAddress,
    });
    return result;
  });
  return serialize(restored);
}

export { findOrFail as findCompanyOrFail, serialize as serializeCompany };
