import { ApiError } from '../utils/ApiError.js';

/** 404 para rutas inexistentes (se registra después de todas las rutas). */
export function notFound(req, _res, next) {
  next(ApiError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}
