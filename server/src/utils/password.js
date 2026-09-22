// Hashing y política de contraseñas (docs/security.md § 3.4).
import bcrypt from 'bcrypt';
import { env } from '../config/env.js';

// Hash de una contraseña ficticia: se compara contra él cuando el usuario no existe
// para que el tiempo de respuesta sea equivalente y no permita enumerar cuentas.
const DUMMY_HASH = '$2b$12$ClO1o.4Gk1ZK7c8NpVQXQeOe5X0rU3z4gS6hM9pQwErTyUiOpAsDf';

export function hashPassword(plain) {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash ?? DUMMY_HASH);
}

/** Compara contra un hash ficticio para igualar tiempos cuando el usuario no existe. */
export async function fakeVerify() {
  await bcrypt.compare('dummy-password', DUMMY_HASH);
  return false;
}
