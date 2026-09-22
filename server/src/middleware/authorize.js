// Autorización basada en permisos (RBAC). El alcance por ownership se aplica en los services.
import { ApiError } from '../utils/ApiError.js';

/**
 * Exige uno o más permisos. Con varios códigos, basta con tener uno (OR).
 * @param {...string} codes
 */
export function authorize(...codes) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    const granted = req.user.permissions ?? [];
    if (codes.some((code) => granted.includes(code))) return next();
    next(ApiError.forbidden());
  };
}

/** true si el usuario tiene el permiso indicado. */
export function can(user, code) {
  return Boolean(user?.permissions?.includes(code));
}
