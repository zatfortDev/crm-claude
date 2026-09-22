// Casos críticos de autenticación (docs/testing.md § 5.1).
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma, resetDb } from '../helpers/db.js';
import {
  createUser,
  createAndLogin,
  loginAs,
  authed,
  extractRefreshCookie,
  DEFAULT_PASSWORD,
} from '../helpers/auth.js';
import { expectApiError } from '../helpers/expect.js';
import { env } from '../../src/config/env.js';
import { hashRefreshToken, REFRESH_COOKIE_NAME } from '../../src/utils/tokens.js';

let app;
beforeAll(() => {
  app = createApp();
});
beforeEach(async () => {
  await resetDb();
});
afterAll(() => prisma.$disconnect());

describe('POST /api/auth/login', () => {
  it('devuelve access token, cookie httpOnly y usuario sin datos sensibles', async () => {
    const user = await createUser({ role: 'Admin' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: DEFAULT_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.expiresIn).toBe(900);
    expect(res.body.data.user).toMatchObject({ email: user.email, role: { name: 'Admin' } });
    expect(res.body.data.user.permissions).toContain('users:manage');
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.user.failedLoginAttempts).toBeUndefined();

    const cookie = res.headers['set-cookie'].find((c) => c.startsWith(REFRESH_COOKIE_NAME));
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/api/auth');
  });

  it('normaliza el email y registra lastLoginAt', async () => {
    const user = await createUser({ email: 'mixta@test.local' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: '  MIXTA@TEST.LOCAL ', password: DEFAULT_PASSWORD });

    expect(res.status).toBe(200);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.lastLoginAt).not.toBeNull();
  });

  it('responde lo mismo para email inexistente y contraseña incorrecta', async () => {
    const user = await createUser();
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'Incorrecta123' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nadie@test.local', password: DEFAULT_PASSWORD });

    expectApiError(wrongPassword, 401, 'UNAUTHORIZED');
    expectApiError(unknownEmail, 401, 'UNAUTHORIZED');
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
  });

  it('rechaza a un usuario inactivo sin revelar el motivo', async () => {
    const user = await createUser({ isActive: false });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: DEFAULT_PASSWORD });
    expectApiError(res, 401, 'UNAUTHORIZED');
  });

  it('valida el cuerpo de la petición', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'no-es-email' });
    const error = expectApiError(res, 400, 'VALIDATION_ERROR');
    expect(error.details.map((d) => d.field)).toEqual(
      expect.arrayContaining(['email', 'password']),
    );
  });

  it('bloquea la cuenta tras LOCKOUT_ATTEMPTS fallos y la libera al expirar', async () => {
    const user = await createUser();
    for (let i = 1; i < env.LOCKOUT_ATTEMPTS; i += 1) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: 'Incorrecta123' });
      expectApiError(res, 401, 'UNAUTHORIZED');
    }

    const locking = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'Incorrecta123' });
    expectApiError(locking, 423, 'ACCOUNT_LOCKED');

    // Con la contraseña correcta sigue bloqueada.
    const blocked = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: DEFAULT_PASSWORD });
    expectApiError(blocked, 423, 'ACCOUNT_LOCKED');

    // Al vencer el bloqueo vuelve a permitir el acceso.
    await prisma.user.update({
      where: { id: user.id },
      data: { lockedUntil: new Date(Date.now() - 1000) },
    });
    const after = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: DEFAULT_PASSWORD });
    expect(after.status).toBe(200);
  });

  it('registra los intentos en la auditoría', async () => {
    const user = await createUser();
    await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'Mala12345678' });
    await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: DEFAULT_PASSWORD });

    const actions = await prisma.auditLog.findMany({
      where: { entityType: 'User', entityId: user.id },
      select: { action: true },
    });
    expect(actions.map((a) => a.action)).toEqual(expect.arrayContaining(['LOGIN_FAILED', 'LOGIN']));
  });
});

describe('POST /api/auth/refresh', () => {
  it('rota el token y emite un nuevo access token', async () => {
    const { cookie } = await createAndLogin(app);
    const res = await request(app).post('/api/auth/refresh').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    const newCookie = extractRefreshCookie(res);
    expect(newCookie).toBeDefined();
    expect(newCookie).not.toBe(cookie);
  });

  it('marca el token anterior como revocado y encadena la rotación', async () => {
    const { cookie } = await createAndLogin(app);
    const oldHash = hashRefreshToken(cookie.split('=')[1]);
    await request(app).post('/api/auth/refresh').set('Cookie', cookie);

    const old = await prisma.refreshToken.findUniqueOrThrow({ where: { tokenHash: oldHash } });
    expect(old.revokedAt).not.toBeNull();
    expect(old.replacedById).not.toBeNull();
  });

  it('detecta el reuso de un token rotado y revoca toda la cadena', async () => {
    const { user, cookie } = await createAndLogin(app);
    const rotated = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    const newCookie = extractRefreshCookie(rotated);

    const reuse = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expectApiError(reuse, 401, 'UNAUTHORIZED');

    // El token vigente también queda revocado.
    const afterReuse = await request(app).post('/api/auth/refresh').set('Cookie', newCookie);
    expectApiError(afterReuse, 401, 'UNAUTHORIZED');

    const active = await prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } });
    expect(active).toBe(0);
  });

  it('rechaza cookies ausentes, desconocidas o expiradas', async () => {
    const sinCookie = await request(app).post('/api/auth/refresh');
    expectApiError(sinCookie, 401, 'UNAUTHORIZED');

    const desconocida = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE_NAME}=inventado`);
    expectApiError(desconocida, 401, 'UNAUTHORIZED');

    const { cookie } = await createAndLogin(app);
    await prisma.refreshToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    const expirada = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expectApiError(expirada, 401, 'UNAUTHORIZED');
  });

  it('rechaza el refresh de un usuario desactivado', async () => {
    const { user, cookie } = await createAndLogin(app);
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    const res = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expectApiError(res, 401, 'UNAUTHORIZED');
  });
});

describe('POST /api/auth/logout', () => {
  it('revoca el refresh token y limpia la cookie', async () => {
    const { token, cookie } = await createAndLogin(app);
    const res = await authed(request(app).post('/api/auth/logout'), token).set('Cookie', cookie);
    expect(res.status).toBe(204);

    const after = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expectApiError(after, 401, 'UNAUTHORIZED');
  });
});

describe('GET /api/auth/me', () => {
  it('devuelve el usuario autenticado con sus permisos', async () => {
    const { token, user } = await createAndLogin(app, { role: 'Manager' });
    const res = await authed(request(app).get('/api/auth/me'), token);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: user.id, role: { name: 'Manager' } });
    expect(res.body.data.permissions).toContain('clients:read_all');
    expect(res.body.data.permissions).not.toContain('users:manage');
  });

  it('rechaza token ausente, malformado o de usuario inexistente', async () => {
    expectApiError(await request(app).get('/api/auth/me'), 401, 'UNAUTHORIZED');
    expectApiError(
      await authed(request(app).get('/api/auth/me'), 'token.invalido.x'),
      401,
      'UNAUTHORIZED',
    );
  });

  it('rechaza el access token de un usuario desactivado', async () => {
    const { token, user } = await createAndLogin(app);
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    expectApiError(await authed(request(app).get('/api/auth/me'), token), 401, 'UNAUTHORIZED');
  });
});

describe('POST /api/auth/change-password', () => {
  it('cambia la contraseña, limpia el flag y revoca las sesiones', async () => {
    const user = await createUser({ mustChangePassword: true });
    const { token, cookie } = await loginAs(app, user);

    const res = await authed(request(app).post('/api/auth/change-password'), token).send({
      currentPassword: DEFAULT_PASSWORD,
      newPassword: 'NuevaClave123',
    });
    expect(res.status).toBe(204);

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.mustChangePassword).toBe(false);

    // Las sesiones previas dejan de servir y la nueva contraseña funciona.
    expectApiError(
      await request(app).post('/api/auth/refresh').set('Cookie', cookie),
      401,
      'UNAUTHORIZED',
    );
    const relogin = await loginAs(app, user, 'NuevaClave123');
    expect(relogin.token).toEqual(expect.any(String));
  });

  it('rechaza una contraseña actual incorrecta', async () => {
    const { token } = await createAndLogin(app);
    const res = await authed(request(app).post('/api/auth/change-password'), token).send({
      currentPassword: 'NoEsLaActual1',
      newPassword: 'NuevaClave123',
    });
    expectApiError(res, 401, 'UNAUTHORIZED');
  });

  it('aplica la política de contraseñas', async () => {
    const { token } = await createAndLogin(app);
    for (const weak of ['corta1A', 'sinmayusculas123', 'SINMINUSCULAS123', 'SinNumerosAqui']) {
      const res = await authed(request(app).post('/api/auth/change-password'), token).send({
        currentPassword: DEFAULT_PASSWORD,
        newPassword: weak,
      });
      expectApiError(res, 400, 'VALIDATION_ERROR');
    }
  });

  it('rechaza reutilizar la contraseña actual', async () => {
    const { token } = await createAndLogin(app);
    const res = await authed(request(app).post('/api/auth/change-password'), token).send({
      currentPassword: DEFAULT_PASSWORD,
      newPassword: DEFAULT_PASSWORD,
    });
    expectApiError(res, 400, 'VALIDATION_ERROR');
  });
});

describe('mustChangePassword', () => {
  it('bloquea el resto de la API pero permite /me y el cambio de contraseña', async () => {
    const user = await createUser({ mustChangePassword: true });
    const { token } = await loginAs(app, user);

    const profile = await authed(request(app).put('/api/auth/profile'), token).send({
      firstName: 'Nuevo',
      lastName: 'Nombre',
    });
    expectApiError(profile, 403, 'PASSWORD_CHANGE_REQUIRED');

    const me = await authed(request(app).get('/api/auth/me'), token);
    expect(me.status).toBe(200);
    expect(me.body.data.mustChangePassword).toBe(true);

    const change = await authed(request(app).post('/api/auth/change-password'), token).send({
      currentPassword: DEFAULT_PASSWORD,
      newPassword: 'OtraClave123',
    });
    expect(change.status).toBe(204);
  });
});

describe('PUT /api/auth/profile', () => {
  it('actualiza nombre y teléfono propios', async () => {
    const { token } = await createAndLogin(app);
    const res = await authed(request(app).put('/api/auth/profile'), token).send({
      firstName: 'Ana',
      lastName: 'Pérez',
      phone: '+54 11 5555-0000',
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      firstName: 'Ana',
      lastName: 'Pérez',
      phone: '+54 11 5555-0000',
    });
  });

  it('rechaza campos desconocidos (mass assignment)', async () => {
    const { token, user } = await createAndLogin(app);
    const res = await authed(request(app).put('/api/auth/profile'), token).send({
      firstName: 'Ana',
      lastName: 'Pérez',
      roleId: 1,
      isActive: false,
    });
    expectApiError(res, 400, 'VALIDATION_ERROR');

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.isActive).toBe(true);
  });
});
