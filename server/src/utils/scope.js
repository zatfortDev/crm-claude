// Alcance por propiedad (ownership). Un usuario sin `<recurso>:read_all` solo ve lo propio
// y sin `<recurso>:update_all` solo modifica lo propio (docs/security.md § 4.3).
import { ApiError } from '../utils/ApiError.js';
import { can } from '../middleware/authorize.js';

/** Fragmento `where` que restringe el listado al alcance del usuario. */
export function ownerScope(user, resource, field = 'ownerId') {
  if (can(user, `${resource}:read_all`)) return {};
  return { [field]: user.id };
}

/** Lanza 404 si el registro está fuera del alcance de lectura (no revela su existencia). */
export function assertCanRead(user, resource, record, field = 'ownerId') {
  if (!record) throw ApiError.notFound();
  if (can(user, `${resource}:read_all`)) return record;
  if (record[field] === user.id) return record;
  throw ApiError.notFound();
}

/** Lanza 403 si el usuario no puede modificar el registro. */
export function assertCanModify(user, resource, record, field = 'ownerId') {
  if (!record) throw ApiError.notFound();
  if (can(user, `${resource}:update_all`)) return record;
  if (record[field] === user.id) return record;
  throw ApiError.forbidden('Solo podés modificar los registros que tenés asignados');
}
