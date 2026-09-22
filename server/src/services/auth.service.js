// Lógica de autenticación: login con bloqueo por intentos, rotación de refresh tokens
// con detección de reuso, logout y cambio de contraseña (docs/security.md § 3).
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { ApiError } from '../utils/ApiError.js';
import { hashPassword, verifyPassword, fakeVerify } from '../utils/password.js';
import {
  signAccessToken,
  accessTokenTtlSeconds,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiresAt,
} from '../utils/tokens.js';
import { toSessionUser } from '../utils/serializers.js';
import { getRolePermissions } from './permission.service.js';
import { logAudit } from './audit.service.js';
import { AUDIT_ACTION } from '../models/constants.js';

const userWithRole = { role: { select: { id: true, name: true } } };

/** Construye la respuesta de sesión: access token + datos del usuario. */
async function buildSession(user) {
  const permissions = await getRolePermissions(user.roleId);
  return {
    accessToken: signAccessToken(user),
    expiresIn: accessTokenTtlSeconds(),
    user: toSessionUser(user, permissions),
  };
}

async function issueRefreshToken(client, { userId, userAgent, ipAddress, replacedById }) {
  const { token, tokenHash } = generateRefreshToken();
  const record = await client.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt: refreshTokenExpiresAt(),
      userAgent: userAgent?.slice(0, 255) ?? null,
      ipAddress: ipAddress?.slice(0, 45) ?? null,
    },
  });
  if (replacedById) {
    await client.refreshToken.update({
      where: { id: replacedById },
      data: { revokedAt: new Date(), replacedById: record.id },
    });
  }
  return token;
}

/** Revoca todos los tokens activos de un usuario (cambio de contraseña, desactivación, reuso). */
export function revokeAllUserTokens(client, userId) {
  return (client ?? prisma).refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function login({ email, password, userAgent, ipAddress }) {
  const user = await prisma.user.findUnique({ where: { email }, include: userWithRole });

  // Usuario inexistente: se compara contra un hash ficticio para no filtrar su existencia.
  if (!user) {
    await fakeVerify();
    logger.warn({ email, ipAddress }, 'Intento de login con email inexistente');
    throw ApiError.unauthorized('Credenciales inválidas');
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    logger.warn({ userId: user.id, ipAddress }, 'Login sobre cuenta bloqueada');
    throw ApiError.locked('Cuenta bloqueada temporalmente por intentos fallidos');
  }

  const passwordOk = await verifyPassword(password, user.passwordHash);

  if (!passwordOk || !user.isActive) {
    // Usuario inactivo: mismo mensaje y mismo contador que credenciales incorrectas.
    const attempts = user.failedLoginAttempts + 1;
    const shouldLock = attempts >= env.LOCKOUT_ATTEMPTS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: shouldLock ? 0 : attempts,
        lockedUntil: shouldLock ? new Date(Date.now() + env.LOCKOUT_MINUTES * 60_000) : null,
      },
    });
    await logAudit(null, {
      entityType: 'User',
      entityId: user.id,
      action: AUDIT_ACTION.LOGIN_FAILED,
      userId: user.id,
      ipAddress,
    });
    logger.warn({ userId: user.id, ipAddress, locked: shouldLock }, 'Login fallido');
    if (shouldLock) throw ApiError.locked('Cuenta bloqueada temporalmente por intentos fallidos');
    throw ApiError.unauthorized('Credenciales inválidas');
  }

  const refreshToken = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    const token = await issueRefreshToken(tx, { userId: user.id, userAgent, ipAddress });
    await logAudit(tx, {
      entityType: 'User',
      entityId: user.id,
      action: AUDIT_ACTION.LOGIN,
      userId: user.id,
      ipAddress,
    });
    return token;
  });

  logger.info({ userId: user.id, ipAddress }, 'Login correcto');
  return { ...(await buildSession(user)), refreshToken };
}

export async function refresh({ token, userAgent, ipAddress }) {
  if (!token) throw ApiError.unauthorized('Sesión no encontrada');

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(token) },
    include: { user: { include: userWithRole } },
  });

  if (!stored) throw ApiError.unauthorized('Sesión inválida');

  // Reuso de un token ya rotado o revocado: se asume robo y se corta toda la cadena.
  if (stored.revokedAt) {
    await revokeAllUserTokens(null, stored.userId);
    logger.warn({ userId: stored.userId, ipAddress }, 'Reuso de refresh token: sesiones revocadas');
    throw ApiError.unauthorized('Sesión inválida');
  }

  if (stored.expiresAt <= new Date()) throw ApiError.unauthorized('Sesión expirada');
  if (!stored.user.isActive) throw ApiError.unauthorized('Sesión inválida');

  const refreshToken = await prisma.$transaction((tx) =>
    issueRefreshToken(tx, {
      userId: stored.userId,
      userAgent,
      ipAddress,
      replacedById: stored.id,
    }),
  );

  return { ...(await buildSession(stored.user)), refreshToken };
}

export async function logout({ token, userId, ipAddress }) {
  if (token) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashRefreshToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  if (userId) {
    await logAudit(null, {
      entityType: 'User',
      entityId: userId,
      action: AUDIT_ACTION.LOGOUT,
      userId,
      ipAddress,
    });
  }
}

export async function getSession(userId) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: userWithRole,
  });
  const permissions = await getRolePermissions(user.roleId);
  return toSessionUser(user, permissions);
}

export async function changePassword({ userId, currentPassword, newPassword, ipAddress }) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) throw ApiError.unauthorized('La contraseña actual es incorrecta');

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });
    // Todas las sesiones se invalidan; el cliente actual recibirá una nueva al hacer login.
    await revokeAllUserTokens(tx, userId);
    await logAudit(tx, {
      entityType: 'User',
      entityId: userId,
      action: AUDIT_ACTION.PASSWORD_CHANGE,
      userId,
      ipAddress,
    });
  });
  logger.info({ userId }, 'Contraseña actualizada');
}

export async function updateProfile({ userId, data }) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { firstName: data.firstName, lastName: data.lastName, phone: data.phone },
    include: userWithRole,
  });
  const permissions = await getRolePermissions(user.roleId);
  return toSessionUser(user, permissions);
}
