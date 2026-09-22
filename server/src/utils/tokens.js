// Emisión y verificación de tokens (docs/security.md § 3).
// Access token: JWT HS256 de vida corta. Refresh token: cadena opaca; en base se guarda su SHA-256.
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const ISSUER = 'crm-api';
const AUDIENCE = 'crm-client';

export const REFRESH_COOKIE_NAME = 'crm_refresh';

/** Firma el access token. El rol va solo como pista para la UI: la autoridad es el servidor. */
export function signAccessToken(user) {
  return jwt.sign({ role: user.role?.name }, env.JWT_ACCESS_SECRET, {
    subject: String(user.id),
    jwtid: crypto.randomUUID(),
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

/** Verifica el access token. Lanza el error de jsonwebtoken si es inválido o expiró. */
export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: ISSUER, audience: AUDIENCE });
}

/** Segundos de vida del access token (para informar al cliente). */
export function accessTokenTtlSeconds() {
  const value = env.JWT_ACCESS_EXPIRES_IN;
  const match = /^(\d+)([smhd])?$/.exec(value);
  if (!match) return 900;
  const amount = Number(match[1]);
  const unit = match[2] ?? 's';
  return amount * { s: 1, m: 60, h: 3600, d: 86400 }[unit];
}

/** Genera un refresh token opaco y su hash para almacenar. */
export function generateRefreshToken() {
  const token = crypto.randomBytes(64).toString('base64url');
  return { token, tokenHash: hashRefreshToken(token) };
}

export function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function refreshTokenExpiresAt(from = new Date()) {
  return new Date(from.getTime() + env.REFRESH_TOKEN_EXPIRES_DAYS * 86400 * 1000);
}

/** Opciones de la cookie del refresh token (restringida a /api/auth). */
export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: env.REFRESH_TOKEN_EXPIRES_DAYS * 86400 * 1000,
  };
}
