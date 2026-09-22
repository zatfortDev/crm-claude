// Error de aplicación con código HTTP y código de negocio estable (docs/architecture.md § 3.3).
export class ApiError extends Error {
  /**
   * @param {number} status  Código HTTP
   * @param {string} code    Código estable para el cliente (VALIDATION_ERROR, NOT_FOUND, ...)
   * @param {string} message Mensaje legible (en español, sin datos sensibles)
   * @param {unknown} [details] Detalle opcional (errores por campo, regla violada, ...)
   */
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }

  static badRequest(message = 'Petición inválida', details) {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }

  static validation(details, message = 'Datos inválidos') {
    return new ApiError(400, 'VALIDATION_ERROR', message, details);
  }

  static unauthorized(message = 'No autenticado') {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'No tenés permiso para realizar esta acción') {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static passwordChangeRequired() {
    return new ApiError(
      403,
      'PASSWORD_CHANGE_REQUIRED',
      'Debés cambiar tu contraseña antes de continuar',
    );
  }

  static notFound(message = 'Recurso no encontrado') {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static conflict(message = 'El recurso ya existe', details) {
    return new ApiError(409, 'CONFLICT', message, details);
  }

  static businessRule(rule, message) {
    return new ApiError(422, 'BUSINESS_RULE', message, { rule });
  }

  static locked(message = 'Cuenta bloqueada temporalmente') {
    return new ApiError(423, 'ACCOUNT_LOCKED', message);
  }

  static rateLimited(message = 'Demasiadas peticiones, intentá más tarde') {
    return new ApiError(429, 'RATE_LIMITED', message);
  }

  static internal(message = 'Error interno del servidor') {
    return new ApiError(500, 'INTERNAL_ERROR', message);
  }
}
