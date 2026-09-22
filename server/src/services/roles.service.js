// Gestión de roles y permisos. Los roles del sistema no se borran ni renombran;
// un rol con usuarios asignados no se borra (docs/database.md § 6, I-04).
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { toRole } from '../utils/serializers.js';
import { PERMISSION_CODES } from '../models/permissions.js';
import { AUDIT_ACTION } from '../models/constants.js';
import { logAudit } from './audit.service.js';
import { invalidatePermissionCache } from './permission.service.js';

const rolePermissionsInclude = {
  permissions: { select: { permission: { select: { code: true } } } },
};

function serialize(role) {
  return toRole(role, {
    permissions: role.permissions?.map((rp) => rp.permission.code) ?? [],
    usersCount: role._count?.users ?? 0,
  });
}

/** Traduce códigos de permiso a ids, rechazando los desconocidos. */
async function resolvePermissionIds(client, codes) {
  const unknown = codes.filter((code) => !PERMISSION_CODES.includes(code));
  if (unknown.length > 0) {
    throw ApiError.validation(
      unknown.map((code) => ({ field: 'permissions', message: `Permiso desconocido: ${code}` })),
    );
  }
  const rows = await client.permission.findMany({
    where: { code: { in: codes } },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

export async function list() {
  const roles = await prisma.role.findMany({
    include: { ...rolePermissionsInclude, _count: { select: { users: true } } },
    orderBy: { id: 'asc' },
  });
  return roles.map(serialize);
}

export async function getById(id) {
  const role = await prisma.role.findUnique({
    where: { id },
    include: { ...rolePermissionsInclude, _count: { select: { users: true } } },
  });
  if (!role) throw ApiError.notFound('Rol no encontrado');
  return serialize(role);
}

export async function listPermissions() {
  const permissions = await prisma.permission.findMany({
    orderBy: [{ module: 'asc' }, { code: 'asc' }],
  });
  // Agrupado por módulo para construir la UI de asignación.
  const grouped = new Map();
  for (const permission of permissions) {
    if (!grouped.has(permission.module)) grouped.set(permission.module, []);
    grouped.get(permission.module).push({
      id: permission.id,
      code: permission.code,
      description: permission.description,
    });
  }
  return [...grouped.entries()].map(([module, items]) => ({ module, permissions: items }));
}

export async function create({ data, actor, ipAddress }) {
  const existing = await prisma.role.findUnique({ where: { name: data.name } });
  if (existing) throw ApiError.conflict('Ya existe un rol con ese nombre');

  const role = await prisma.$transaction(async (tx) => {
    const permissionIds = await resolvePermissionIds(tx, data.permissions);
    const created = await tx.role.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        isSystem: false,
        permissions: { create: permissionIds.map((permissionId) => ({ permissionId })) },
      },
      include: { ...rolePermissionsInclude, _count: { select: { users: true } } },
    });
    await logAudit(tx, {
      entityType: 'Role',
      entityId: created.id,
      action: AUDIT_ACTION.CREATE,
      changes: { after: { name: created.name, permissions: data.permissions } },
      userId: actor.id,
      ipAddress,
    });
    return created;
  });
  return serialize(role);
}

export async function update({ id, data, actor, ipAddress }) {
  const role = await prisma.$transaction(async (tx) => {
    const current = await tx.role.findUnique({ where: { id }, include: rolePermissionsInclude });
    if (!current) throw ApiError.notFound('Rol no encontrado');

    // Los roles del sistema conservan su nombre; solo cambian descripción y permisos.
    if (current.isSystem && data.name !== current.name) {
      throw ApiError.businessRule('SYSTEM_ROLE', 'No se puede renombrar un rol del sistema');
    }
    if (!current.isSystem && data.name !== current.name) {
      const duplicated = await tx.role.findUnique({ where: { name: data.name } });
      if (duplicated) throw ApiError.conflict('Ya existe un rol con ese nombre');
    }

    const permissionIds = await resolvePermissionIds(tx, data.permissions);
    await tx.rolePermission.deleteMany({ where: { roleId: id } });
    const updated = await tx.role.update({
      where: { id },
      data: {
        name: current.isSystem ? current.name : data.name,
        description: data.description ?? null,
        permissions: { create: permissionIds.map((permissionId) => ({ permissionId })) },
      },
      include: { ...rolePermissionsInclude, _count: { select: { users: true } } },
    });

    await logAudit(tx, {
      entityType: 'Role',
      entityId: id,
      action: AUDIT_ACTION.UPDATE,
      changes: {
        before: { permissions: current.permissions.map((rp) => rp.permission.code) },
        after: { permissions: data.permissions },
      },
      userId: actor.id,
      ipAddress,
    });
    return updated;
  });

  // Los permisos cacheados del rol dejan de ser válidos inmediatamente.
  invalidatePermissionCache(id);
  return serialize(role);
}

export async function remove({ id, actor, ipAddress }) {
  await prisma.$transaction(async (tx) => {
    const role = await tx.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw ApiError.notFound('Rol no encontrado');
    if (role.isSystem) {
      throw ApiError.businessRule('SYSTEM_ROLE', 'No se puede eliminar un rol del sistema');
    }
    if (role._count.users > 0) {
      throw ApiError.businessRule(
        'ROLE_IN_USE',
        'No se puede eliminar un rol con usuarios asignados',
      );
    }

    await tx.rolePermission.deleteMany({ where: { roleId: id } });
    await tx.role.delete({ where: { id } });
    await logAudit(tx, {
      entityType: 'Role',
      entityId: id,
      action: AUDIT_ACTION.DELETE,
      changes: { before: { name: role.name } },
      userId: actor.id,
      ipAddress,
    });
  });
  invalidatePermissionCache(id);
}
