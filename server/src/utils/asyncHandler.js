/** Envuelve un controlador async para que los rechazos lleguen al errorHandler. */
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
