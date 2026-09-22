// Autenticación: valida el access token y carga el usuario con sus permisos efectivos.
// Se relee el usuario en cada request para que desactivaciones y cambios de rol sean inmediatos.
import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/tokens.js';
import { prisma } from '../lib/prisma.js';
import { getRolePermissions } from '../services/permission.service.js';

/** Rutas accesibles aun con `mustChangePassword` activo. */
const PASSWORD_CHANGE_ALLOWLIST = new Set([
  'GET /api/auth/me',
  'POST /api/auth/change-password',
  'POST /api/auth/logout',
  'POST /api/auth/refresh',
]);

export async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw ApiError.unauthorized('Token de acceso ausente');

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err) {
      const message = err.name === 'TokenExpiredError' ? 'Sesión expirada' : 'Token inválido';
      throw ApiError.unauthorized(message);
    }

    const user = await prisma.user.findUnique({
      where: { id: Number(payload.sub) },
      include: { role: { select: { id: true, name: true } } },
    });
    if (!user || !user.isActive) throw ApiError.unauthorized('Sesión inválida');

    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roleId: user.roleId,
      role: user.role,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      permissions: await getRolePermissions(user.roleId),
    };
    next();
  } catch (err) {
    next(err);
  }
}

/** Bloquea el acceso al resto de la API mientras el usuario deba cambiar su contraseña. */
export function requireFreshPassword(req, _res, next) {
  if (!req.user?.mustChangePassword) return next();
  const key = `${req.method} ${req.baseUrl}${req.path === '/' ? '' : req.path}`;
  if (PASSWORD_CHANGE_ALLOWLIST.has(key)) return next();
  next(ApiError.passwordChangeRequired());
}
