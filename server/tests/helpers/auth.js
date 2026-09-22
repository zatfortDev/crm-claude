// Helpers para crear usuarios y obtener credenciales en los tests.
import request from 'supertest';
import { prisma } from '../../src/lib/prisma.js';
import { hashPassword } from '../../src/utils/password.js';
import { REFRESH_COOKIE_NAME } from '../../src/utils/tokens.js';

export const DEFAULT_PASSWORD = 'Password123';

let counter = 0;

/** Crea un usuario activo con contraseña conocida. */
export async function createUser({
  role = 'Vendedor',
  email,
  password = DEFAULT_PASSWORD,
  firstName = 'Test',
  lastName = 'User',
  isActive = true,
  mustChangePassword = false,
} = {}) {
  const roleRecord = await prisma.role.findUniqueOrThrow({ where: { name: role } });
  counter += 1;
  return prisma.user.create({
    data: {
      email: email ?? `user${counter}.${Date.now()}@test.local`,
      passwordHash: await hashPassword(password),
      firstName,
      lastName,
      roleId: roleRecord.id,
      isActive,
      mustChangePassword,
    },
    include: { role: true },
  });
}

/** Inicia sesión y devuelve token, cookie y usuario de la respuesta. */
export async function loginAs(app, user, password = DEFAULT_PASSWORD) {
  const res = await request(app).post('/api/auth/login').send({ email: user.email, password });
  if (res.status !== 200) {
    throw new Error(`Login falló (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return {
    token: res.body.data.accessToken,
    cookie: extractRefreshCookie(res),
    user: res.body.data.user,
  };
}

/** Crea un usuario y devuelve directamente sus credenciales. */
export async function createAndLogin(app, options = {}) {
  const user = await createUser(options);
  const session = await loginAs(app, user, options.password);
  return { user, ...session };
}

export function extractRefreshCookie(res) {
  const cookies = res.headers['set-cookie'] ?? [];
  const cookie = cookies.find((c) => c.startsWith(`${REFRESH_COOKIE_NAME}=`));
  return cookie ? cookie.split(';')[0] : undefined;
}

/** Añade la cabecera Authorization a una petición de Supertest. */
export function authed(req, token) {
  return req.set('Authorization', `Bearer ${token}`);
}
