// Serializadores: definen qué campos salen de la API. Nunca exponen passwordHash
// ni metadatos de seguridad (docs/security.md § 2, T-09).

export function toPublicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`,
    phone: user.phone ?? null,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt,
    role: user.role ? { id: user.role.id, name: user.role.name } : undefined,
  };
}

/** Datos del usuario autenticado, con sus permisos efectivos. */
export function toSessionUser(user, permissions) {
  return { ...toPublicUser(user), permissions };
}

export function toUserOption(user) {
  return { id: user.id, firstName: user.firstName, lastName: user.lastName };
}

export function toRole(role, { permissions, usersCount } = {}) {
  return {
    id: role.id,
    name: role.name,
    description: role.description ?? null,
    isSystem: role.isSystem,
    permissions: permissions ?? role.permissions?.map((rp) => rp.permission.code),
    usersCount: usersCount ?? role._count?.users,
  };
}
