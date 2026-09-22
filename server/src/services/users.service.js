// Gestión de usuarios (solo Admin). Reglas: el último Admin activo está protegido,
// nadie cambia su propio rol y los usuarios nunca se borran (docs/database.md § 6).
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { hashPassword } from '../utils/password.js';
import { toPublicUser, toUserOption } from '../utils/serializers.js';
import { toPrismaPagination } from '../utils/pagination.js';
import { logAudit, diffChanges } from './audit.service.js';
import { revokeAllUserTokens } from './auth.service.js';
import { AUDIT_ACTION, SYSTEM_ROLES } from '../models/constants.js';

const withRole = { role: { select: { id: true, name: true } } };

/** Lanza 422 si la operación dejaría al sistema sin ningún Admin activo. */
async function assertNotLastAdmin(client, userId) {
  const user = await client.user.findUnique({ where: { id: userId }, include: withRole });
  if (user?.role.name !== SYSTEM_ROLES.ADMIN || !user.isActive) return;

  const activeAdmins = await client.user.count({
    where: { isActive: true, role: { name: SYSTEM_ROLES.ADMIN } },
  });
  if (activeAdmins <= 1) {
    throw ApiError.businessRule(
      'LAST_ADMIN',
      'No se puede desactivar ni cambiar el rol del último administrador activo',
    );
  }
}

export async function list({ page, pageSize, sortBy, sortOrder, search, roleId, isActive }) {
  const where = {
    ...(roleId ? { roleId } : {}),
    ...(isActive === undefined ? {} : { isActive }),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search } },
            { lastName: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: withRole,
      ...toPrismaPagination({ page, pageSize, sortBy, sortOrder }),
    }),
    prisma.user.count({ where }),
  ]);
  return { items: items.map(toPublicUser), total };
}

export async function getById(id) {
  const user = await prisma.user.findUnique({ where: { id }, include: withRole });
  if (!user) throw ApiError.notFound('Usuario no encontrado');
  return toPublicUser(user);
}

/** Usuarios activos para selectores de responsable. */
export async function options() {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });
  return users.map(toUserOption);
}

export async function create({ data, actor, ipAddress }) {
  const role = await prisma.role.findUnique({ where: { id: data.roleId } });
  if (!role) throw ApiError.validation([{ field: 'roleId', message: 'El rol indicado no existe' }]);

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw ApiError.conflict('Ya existe un usuario con ese email');

  const passwordHash = await hashPassword(data.temporaryPassword);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone ?? null,
        roleId: data.roleId,
        mustChangePassword: true,
      },
      include: withRole,
    });
    await logAudit(tx, {
      entityType: 'User',
      entityId: created.id,
      action: AUDIT_ACTION.CREATE,
      changes: { after: { email: created.email, roleId: created.roleId } },
      userId: actor.id,
      ipAddress,
    });
    return created;
  });
  return toPublicUser(user);
}

export async function update({ id, data, actor, ipAddress }) {
  const current = await prisma.user.findUnique({ where: { id } });
  if (!current) throw ApiError.notFound('Usuario no encontrado');

  if (data.email !== current.email) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw ApiError.conflict('Ya existe un usuario con ese email');
  }

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id },
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone ?? null,
      },
      include: withRole,
    });
    const changes = diffChanges(current, updated);
    if (changes) {
      await logAudit(tx, {
        entityType: 'User',
        entityId: id,
        action: AUDIT_ACTION.UPDATE,
        changes,
        userId: actor.id,
        ipAddress,
      });
    }
    return updated;
  });
  return toPublicUser(user);
}

export async function setStatus({ id, isActive, actor, ipAddress }) {
  if (id === actor.id && !isActive) {
    throw ApiError.businessRule('SELF_DEACTIVATION', 'No podés desactivar tu propio usuario');
  }

  const user = await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({ where: { id }, include: withRole });
    if (!current) throw ApiError.notFound('Usuario no encontrado');
    if (current.isActive === isActive) return current;
    if (!isActive) await assertNotLastAdmin(tx, id);

    const updated = await tx.user.update({
      where: { id },
      data: {
        isActive,
        // Al reactivar se limpia cualquier bloqueo pendiente.
        ...(isActive ? { failedLoginAttempts: 0, lockedUntil: null } : {}),
      },
      include: withRole,
    });
    // Desactivar cierra todas las sesiones abiertas del usuario.
    if (!isActive) await revokeAllUserTokens(tx, id);

    await logAudit(tx, {
      entityType: 'User',
      entityId: id,
      action: AUDIT_ACTION.STATUS_CHANGE,
      changes: { before: { isActive: current.isActive }, after: { isActive } },
      userId: actor.id,
      ipAddress,
    });
    return updated;
  });
  return toPublicUser(user);
}

export async function setRole({ id, roleId, actor, ipAddress }) {
  if (id === actor.id) {
    throw ApiError.businessRule('SELF_ROLE_CHANGE', 'No podés cambiar tu propio rol');
  }

  const user = await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({ where: { id }, include: withRole });
    if (!current) throw ApiError.notFound('Usuario no encontrado');

    const role = await tx.role.findUnique({ where: { id: roleId } });
    if (!role)
      throw ApiError.validation([{ field: 'roleId', message: 'El rol indicado no existe' }]);
    if (current.roleId === roleId) return current;

    // Degradar al último Admin dejaría el sistema sin administración.
    await assertNotLastAdmin(tx, id);

    const updated = await tx.user.update({ where: { id }, data: { roleId }, include: withRole });
    await logAudit(tx, {
      entityType: 'User',
      entityId: id,
      action: AUDIT_ACTION.ROLE_CHANGE,
      changes: { before: { roleId: current.roleId }, after: { roleId } },
      userId: actor.id,
      ipAddress,
    });
    return updated;
  });
  return toPublicUser(user);
}

export async function resetPassword({ id, temporaryPassword, actor, ipAddress }) {
  const current = await prisma.user.findUnique({ where: { id } });
  if (!current) throw ApiError.notFound('Usuario no encontrado');

  const passwordHash = await hashPassword(temporaryPassword);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true, failedLoginAttempts: 0, lockedUntil: null },
    });
    await revokeAllUserTokens(tx, id);
    await logAudit(tx, {
      entityType: 'User',
      entityId: id,
      action: AUDIT_ACTION.PASSWORD_CHANGE,
      userId: actor.id,
      ipAddress,
    });
  });
}
