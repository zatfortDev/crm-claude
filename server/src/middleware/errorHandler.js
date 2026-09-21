// Manejo centralizado de errores: toda excepción termina aquí con el formato uniforme.
// En producción nunca se devuelven stack traces ni mensajes internos.
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

/** Traduce errores conocidos de Prisma a ApiError. */
function fromPrismaError(err) {
  switch (err.code) {
    case 'P2002': // violación de unicidad
      return ApiError.conflict('Ya existe un registro con esos datos', {
        fields: err.meta?.target ?? undefined,
      });
    case 'P2025': // registro no encontrado en update/delete
      return ApiError.notFound();
    case 'P2003': // violación de clave foránea
      return ApiError.businessRule(
        'FOREIGN_KEY',
        'La operación viola una relación entre registros',
      );
    default:
      return null;
  }
}

function formatZodIssues(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || undefined,
    message: issue.message,
  }));
}

// Express identifica el middleware de error por su aridad (4 argumentos).
export function errorHandler(err, req, res, _next) {
  let apiError;

  if (err instanceof ApiError) {
    apiError = err;
  } else if (err instanceof ZodError) {
    apiError = ApiError.validation(formatZodIssues(err));
  } else if (err?.type === 'entity.parse.failed') {
    apiError = ApiError.badRequest('JSON malformado');
  } else if (err?.type === 'entity.too.large') {
    apiError = new ApiError(
      413,
      'PAYLOAD_TOO_LARGE',
      'El cuerpo de la petición es demasiado grande',
    );
  } else if (typeof err?.code === 'string' && err.code.startsWith('P2')) {
    apiError = fromPrismaError(err);
  }

  const isUnexpected = !apiError;
  if (isUnexpected) apiError = ApiError.internal();

  const logPayload = {
    requestId: req.id,
    code: apiError.code,
    status: apiError.status,
    path: req.originalUrl,
  };
  if (isUnexpected || apiError.status >= 500) {
    logger.error({ ...logPayload, err }, 'Error no controlado');
  } else if (
    apiError.status === 401 ||
    apiError.status === 403 ||
    apiError.status === 423 ||
    apiError.status === 429
  ) {
    logger.warn({ ...logPayload, userId: req.user?.id }, apiError.message);
  } else {
    logger.debug(logPayload, apiError.message);
  }

  const body = {
    success: false,
    error: { code: apiError.code, message: apiError.message },
  };
  if (apiError.details !== undefined) body.error.details = apiError.details;
  if (!env.isProduction && isUnexpected)
    body.error.debug = { message: err?.message, stack: err?.stack };

  res.status(apiError.status).json(body);
}
