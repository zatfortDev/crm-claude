// Helpers para el envoltorio de respuesta uniforme de la API.

/** Respuesta de éxito con un objeto o valor. */
export function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

/** Respuesta de creación (201). */
export function created(res, data) {
  return ok(res, data, 201);
}

/** Respuesta sin contenido (204). */
export function noContent(res) {
  return res.status(204).end();
}

/** Respuesta de listado paginado. */
export function paginated(res, { items, total, page, pageSize }) {
  return res.status(200).json({
    success: true,
    data: items,
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}
