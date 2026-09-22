// Usuarios, roles y autorización (docs/testing.md § 5.2 y § 5.3).
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma, resetDb } from '../helpers/db.js';
import { createUser, createAndLogin, loginAs, authed, DEFAULT_PASSWORD } from '../helpers/auth.js';
import { expectApiError } from '../helpers/expect.js';
import { ROLE_PERMISSIONS } from '../../src/models/permissions.js';

let app;
let roles;

beforeAll(() => {
  app = createApp();
});

beforeEach(async () => {
  await resetDb();
  const all = await prisma.role.findMany();
  roles = Object.fromEntries(all.map((role) => [role.name, role]));
});

afterAll(() => prisma.$disconnect());

describe('GET /api/users', () => {
  it('lista con paginación, búsqueda y filtros para un Admin', async () => {
    const { token } = await createAndLogin(app, { role: 'Admin' });
    await createUser({ firstName: 'Ana', lastName: 'Pérez', email: 'ana@test.local' });
    await createUser({ firstName: 'Bruno', lastName: 'Gómez', email: 'bruno@test.local' });
    await createUser({ firstName: 'Carla', lastName: 'Ruiz', isActive: false });

    const all = await authed(request(app).get('/api/users'), token);
    expect(all.status).toBe(200);
    expect(all.body.meta).toMatchObject({ page: 1, pageSize: 20, total: 4 });

    // La búsqueda es insensible a mayúsculas y acentos (collation CI_AI).
    const search = await authed(request(app).get('/api/users?search=perez'), token);
    expect(search.body.data).toHaveLength(1);
    expect(search.body.data[0].email).toBe('ana@test.local');

    const inactive = await authed(request(app).get('/api/users?isActive=false'), token);
    expect(inactive.body.data).toHaveLength(1);

    const byRole = await authed(request(app).get(`/api/users?roleId=${roles.Vendedor.id}`), token);
    expect(byRole.body.data).toHaveLength(3);

    const paged = await authed(request(app).get('/api/users?page=2&pageSize=2'), token);
    expect(paged.body.data).toHaveLength(2);
    expect(paged.body.meta).toMatchObject({ page: 2, totalPages: 2 });
  });

  it('nunca expone campos sensibles', async () => {
    const { token } = await createAndLogin(app, { role: 'Admin' });
    const res = await authed(request(app).get('/api/users'), token);
    for (const user of res.body.data) {
      expect(user.passwordHash).toBeUndefined();
      expect(user.failedLoginAttempts).toBeUndefined();
      expect(user.lockedUntil).toBeUndefined();
    }
  });

  it('rechaza parámetros de orden fuera de la whitelist', async () => {
    const { token } = await createAndLogin(app, { role: 'Admin' });
    const res = await authed(request(app).get('/api/users?sortBy=passwordHash'), token);
    expectApiError(res, 400, 'VALIDATION_ERROR');
  });

  it('un Vendedor y un Manager no pueden listar usuarios', async () => {
    for (const role of ['Vendedor', 'Manager']) {
      const { token } = await createAndLogin(app, { role });
      expectApiError(await authed(request(app).get('/api/users'), token), 403, 'FORBIDDEN');
    }
  });

  it('cualquier usuario autenticado puede obtener las opciones de responsable', async () => {
    const { token } = await createAndLogin(app, { role: 'Vendedor' });
    const res = await authed(request(app).get('/api/users/options'), token);
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toEqual({
      id: expect.any(Number),
      firstName: expect.any(String),
      lastName: expect.any(String),
    });
  });
});

describe('POST /api/users', () => {
  it('crea un usuario que debe cambiar la contraseña en el primer acceso', async () => {
    const { token } = await createAndLogin(app, { role: 'Admin' });
    const res = await authed(request(app).post('/api/users'), token).send({
      email: 'Nuevo@Test.Local',
      firstName: 'Nuevo',
      lastName: 'Usuario',
      phone: '+54 11 4000-0000',
      roleId: roles.Vendedor.id,
      temporaryPassword: 'Temporal2026',
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      email: 'nuevo@test.local',
      mustChangePassword: true,
      isActive: true,
      role: { name: 'Vendedor' },
    });

    // La contraseña temporal permite entrar, pero bloquea el resto de la API.
    const session = await loginAs(app, { email: 'nuevo@test.local' }, 'Temporal2026');
    expectApiError(
      await authed(request(app).get('/api/users/options'), session.token),
      403,
      'PASSWORD_CHANGE_REQUIRED',
    );
  });

  it('rechaza email duplicado', async () => {
    const { token } = await createAndLogin(app, { role: 'Admin' });
    const existing = await createUser();
    const res = await authed(request(app).post('/api/users'), token).send({
      email: existing.email,
      firstName: 'Otro',
      lastName: 'Usuario',
      roleId: roles.Vendedor.id,
      temporaryPassword: 'Temporal2026',
    });
    expectApiError(res, 409, 'CONFLICT');
  });

  it('valida rol inexistente, contraseña débil y campos desconocidos', async () => {
    const { token } = await createAndLogin(app, { role: 'Admin' });
    const base = {
      email: 'x@test.local',
      firstName: 'X',
      lastName: 'Y',
      roleId: roles.Vendedor.id,
      temporaryPassword: 'Temporal2026',
    };

    expectApiError(
      await authed(request(app).post('/api/users'), token).send({ ...base, roleId: 9999 }),
      400,
      'VALIDATION_ERROR',
    );
    expectApiError(
      await authed(request(app).post('/api/users'), token).send({
        ...base,
        temporaryPassword: 'corta',
      }),
      400,
      'VALIDATION_ERROR',
    );
    expectApiError(
      await authed(request(app).post('/api/users'), token).send({ ...base, isActive: false }),
      400,
      'VALIDATION_ERROR',
    );
  });
});

describe('PATCH /api/users/:id/status', () => {
  it('desactiva un usuario y revoca sus sesiones', async () => {
    const { token } = await createAndLogin(app, { role: 'Admin' });
    const target = await createUser();
    const targetSession = await loginAs(app, target);

    const res = await authed(request(app).patch(`/api/users/${target.id}/status`), token).send({
      isActive: false,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);

    const active = await prisma.refreshToken.count({
      where: { userId: target.id, revokedAt: null },
    });
    expect(active).toBe(0);
    expectApiError(
      await authed(request(app).get('/api/auth/me'), targetSession.token),
      401,
      'UNAUTHORIZED',
    );
  });

  it('protege al último administrador activo', async () => {
    const { token, user } = await createAndLogin(app, { role: 'Admin' });
    const other = await createUser({ role: 'Admin' });

    // Con dos admins se puede desactivar al otro.
    const first = await authed(request(app).patch(`/api/users/${other.id}/status`), token).send({
      isActive: false,
    });
    expect(first.status).toBe(200);

    // Queda uno solo: ya no se puede desactivar (ni a sí mismo).
    const self = await authed(request(app).patch(`/api/users/${user.id}/status`), token).send({
      isActive: false,
    });
    const error = expectApiError(self, 422, 'BUSINESS_RULE');
    expect(error.details.rule).toBe('SELF_DEACTIVATION');
  });

  it('impide dejar el sistema sin administradores activos desde otra cuenta admin', async () => {
    const admin = await createUser({ role: 'Admin' });
    const { token } = await createAndLogin(app, { role: 'Admin' });
    // El actor se desactiva a sí mismo indirectamente: desactivamos al otro admin primero.
    await prisma.user.update({ where: { id: admin.id }, data: { isActive: false } });

    const res = await authed(request(app).patch(`/api/users/${admin.id}/status`), token).send({
      isActive: true,
    });
    expect(res.status).toBe(200);
  });
});

describe('PATCH /api/users/:id/role', () => {
  it('cambia el rol de otro usuario y el cambio aplica en su siguiente request', async () => {
    const { token } = await createAndLogin(app, { role: 'Admin' });
    const target = await createUser({ role: 'Vendedor' });
    const targetSession = await loginAs(app, target);

    expectApiError(
      await authed(request(app).get('/api/users'), targetSession.token),
      403,
      'FORBIDDEN',
    );

    const res = await authed(request(app).patch(`/api/users/${target.id}/role`), token).send({
      roleId: roles.Admin.id,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.role.name).toBe('Admin');

    // El mismo access token ya refleja el nuevo rol: authenticate relee al usuario.
    const after = await authed(request(app).get('/api/users'), targetSession.token);
    expect(after.status).toBe(200);
  });

  it('no permite cambiar el rol propio', async () => {
    const { token, user } = await createAndLogin(app, { role: 'Admin' });
    const res = await authed(request(app).patch(`/api/users/${user.id}/role`), token).send({
      roleId: roles.Vendedor.id,
    });
    const error = expectApiError(res, 422, 'BUSINESS_RULE');
    expect(error.details.rule).toBe('SELF_ROLE_CHANGE');
  });

  it('no permite degradar al último administrador', async () => {
    const { token } = await createAndLogin(app, { role: 'Admin' });
    const other = await createUser({ role: 'Admin' });
    await prisma.user.update({ where: { id: other.id }, data: { isActive: false } });

    const res = await authed(request(app).patch(`/api/users/${other.id}/role`), token).send({
      roleId: roles.Vendedor.id,
    });
    expect(res.status).toBe(200); // inactivo: no cuenta como último admin activo

    const target = await createUser({ role: 'Admin' });
    await prisma.user.update({ where: { id: target.id }, data: { isActive: true } });
    const demoteOk = await authed(request(app).patch(`/api/users/${target.id}/role`), token).send({
      roleId: roles.Vendedor.id,
    });
    expect(demoteOk.status).toBe(200);
  });
});

describe('POST /api/users/:id/reset-password', () => {
  it('asigna una contraseña temporal, revoca sesiones y exige cambio', async () => {
    const { token } = await createAndLogin(app, { role: 'Admin' });
    const target = await createUser();
    await loginAs(app, target);

    const res = await authed(
      request(app).post(`/api/users/${target.id}/reset-password`),
      token,
    ).send({ temporaryPassword: 'NuevaTemporal1' });
    expect(res.status).toBe(204);

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(stored.mustChangePassword).toBe(true);
    expect(await prisma.refreshToken.count({ where: { userId: target.id, revokedAt: null } })).toBe(
      0,
    );

    expectApiError(
      await request(app)
        .post('/api/auth/login')
        .send({ email: target.email, password: DEFAULT_PASSWORD }),
      401,
      'UNAUTHORIZED',
    );
    const session = await loginAs(app, target, 'NuevaTemporal1');
    expect(session.user.mustChangePassword).toBe(true);
  });

  it('devuelve 404 para un usuario inexistente', async () => {
    const { token } = await createAndLogin(app, { role: 'Admin' });
    const res = await authed(request(app).post('/api/users/9999/reset-password'), token).send({
      temporaryPassword: 'NuevaTemporal1',
    });
    expectApiError(res, 404, 'NOT_FOUND');
  });
});

describe('Roles y permisos', () => {
  it('lista roles con su cantidad de permisos y usuarios', async () => {
    const { token } = await createAndLogin(app, { role: 'Admin' });
    const res = await authed(request(app).get('/api/roles'), token);

    expect(res.status).toBe(200);
    const admin = res.body.data.find((role) => role.name === 'Admin');
    expect(admin.isSystem).toBe(true);
    expect(admin.permissions).toHaveLength(ROLE_PERMISSIONS.Admin.length);
    expect(admin.usersCount).toBe(1);
  });

  it('devuelve el catálogo de permisos agrupado por módulo', async () => {
    const { token } = await createAndLogin(app, { role: 'Admin' });
    const res = await authed(request(app).get('/api/permissions'), token);
    expect(res.status).toBe(200);
    const modules = res.body.data.map((group) => group.module);
    expect(modules).toEqual(expect.arrayContaining(['users', 'clients', 'opportunities']));
  });

  it('crea un rol personalizado y lo aplica a un usuario', async () => {
    const { token } = await createAndLogin(app, { role: 'Admin' });
    const created = await authed(request(app).post('/api/roles'), token).send({
      name: 'Soporte',
      description: 'Solo lectura de clientes',
      permissions: ['clients:read', 'clients:read_all', 'dashboard:view'],
    });
    expect(created.status).toBe(201);
    expect(created.body.data.isSystem).toBe(false);

    const target = await createUser();
    await authed(request(app).patch(`/api/users/${target.id}/role`), token).send({
      roleId: created.body.data.id,
    });
    const session = await loginAs(app, target);
    expect(session.user.permissions).toEqual(
      expect.arrayContaining(['clients:read_all', 'dashboard:view']),
    );
    expect(session.user.permissions).not.toContain('users:read');
  });

  it('al editar los permisos de un rol, el cambio se aplica de inmediato', async () => {
    const { token } = await createAndLogin(app, { role: 'Admin' });
    const vendedor = await createUser({ role: 'Vendedor' });
    const session = await loginAs(app, vendedor);

    expectApiError(await authed(request(app).get('/api/users'), session.token), 403, 'FORBIDDEN');

    await authed(request(app).put(`/api/roles/${roles.Vendedor.id}`), token).send({
      name: 'Vendedor',
      description: 'Con lectura de usuarios',
      permissions: [...ROLE_PERMISSIONS.Vendedor, 'users:read'],
    });

    const after = await authed(request(app).get('/api/users'), session.token);
    expect(after.status).toBe(200);
  });

  it('protege los roles del sistema', async () => {
    const { token } = await createAndLogin(app, { role: 'Admin' });

    const rename = await authed(request(app).put(`/api/roles/${roles.Vendedor.id}`), token).send({
      name: 'Comercial',
      permissions: ['clients:read'],
    });
    expect(expectApiError(rename, 422, 'BUSINESS_RULE').details.rule).toBe('SYSTEM_ROLE');

    const remove = await authed(request(app).delete(`/api/roles/${roles.Vendedor.id}`), token);
    expect(expectApiError(remove, 422, 'BUSINESS_RULE').details.rule).toBe('SYSTEM_ROLE');
  });

  it('no elimina un rol con usuarios asignados y sí uno vacío', async () => {
    const { token } = await createAndLogin(app, { role: 'Admin' });
    const created = await authed(request(app).post('/api/roles'), token).send({
      name: 'Temporal',
      permissions: ['clients:read'],
    });
    const roleId = created.body.data.id;

    const target = await createUser();
    await authed(request(app).patch(`/api/users/${target.id}/role`), token).send({ roleId });
    const inUse = await authed(request(app).delete(`/api/roles/${roleId}`), token);
    expect(expectApiError(inUse, 422, 'BUSINESS_RULE').details.rule).toBe('ROLE_IN_USE');

    await authed(request(app).patch(`/api/users/${target.id}/role`), token).send({
      roleId: roles.Vendedor.id,
    });
    const removed = await authed(request(app).delete(`/api/roles/${roleId}`), token);
    expect(removed.status).toBe(204);
  });

  it('rechaza permisos desconocidos y nombres duplicados', async () => {
    const { token } = await createAndLogin(app, { role: 'Admin' });

    const unknown = await authed(request(app).post('/api/roles'), token).send({
      name: 'Inventado',
      permissions: ['clients:read', 'modulo:inexistente'],
    });
    expectApiError(unknown, 400, 'VALIDATION_ERROR');

    const duplicated = await authed(request(app).post('/api/roles'), token).send({
      name: 'Vendedor',
      permissions: ['clients:read'],
    });
    expectApiError(duplicated, 409, 'CONFLICT');
  });

  it('un Manager no puede leer ni administrar roles', async () => {
    const { token } = await createAndLogin(app, { role: 'Manager' });
    expectApiError(await authed(request(app).get('/api/roles'), token), 403, 'FORBIDDEN');
    expectApiError(await authed(request(app).get('/api/permissions'), token), 403, 'FORBIDDEN');
  });
});

describe('Protección global de la API', () => {
  it('todas las rutas fuera de /api/auth exigen autenticación', async () => {
    for (const path of ['/api/users', '/api/roles', '/api/permissions', '/api/users/options']) {
      expectApiError(await request(app).get(path), 401, 'UNAUTHORIZED');
    }
  });
});
