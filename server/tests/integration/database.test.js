import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma, resetDb } from '../helpers/db.js';
import { PERMISSIONS, ROLE_PERMISSIONS } from '../../src/models/permissions.js';

let app;
beforeAll(async () => {
  await resetDb();
  app = createApp();
});
afterAll(() => prisma.$disconnect());

describe('Base de datos de test', () => {
  it('GET /health responde 200 con la base conectada', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'ok' });
  });

  it('el seed deja roles, permisos y catálogos', async () => {
    expect(await prisma.role.count()).toBe(3);
    expect(await prisma.permission.count()).toBe(PERMISSIONS.length);
    expect(await prisma.pipelineStage.count()).toBe(6);
    expect(await prisma.leadSource.count()).toBe(8);
    expect(await prisma.setting.count()).toBe(4);

    const admin = await prisma.role.findUnique({
      where: { name: 'Admin' },
      include: { permissions: true },
    });
    expect(admin.isSystem).toBe(true);
    expect(admin.permissions).toHaveLength(ROLE_PERMISSIONS.Admin.length);
  });

  it('el índice único filtrado permite varios contactos sin email pero no emails repetidos', async () => {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: 'Admin' } });
    const user = await prisma.user.create({
      data: {
        email: 'u@test.local',
        passwordHash: 'x',
        firstName: 'U',
        lastName: 'T',
        roleId: role.id,
      },
    });
    await prisma.contact.create({ data: { firstName: 'a', lastName: 'b', createdById: user.id } });
    await prisma.contact.create({ data: { firstName: 'c', lastName: 'd', createdById: user.id } });
    await prisma.contact.create({
      data: { firstName: 'e', lastName: 'f', email: 'dup@test.local', createdById: user.id },
    });
    await expect(
      prisma.contact.create({
        data: { firstName: 'g', lastName: 'h', email: 'DUP@test.local', createdById: user.id },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('las CHECK constraints rechazan valores fuera de dominio', async () => {
    const user = await prisma.user.findFirstOrThrow();
    await expect(
      prisma.lead.create({
        data: { firstName: 'x', lastName: 'y', status: 'INVALIDO', createdById: user.id },
      }),
    ).rejects.toThrow(/CK_Lead_status/);
  });

  it('la collation hace búsquedas insensibles a mayúsculas y acentos', async () => {
    const user = await prisma.user.findFirstOrThrow();
    await prisma.company.create({ data: { name: 'Pérez Hnos.', createdById: user.id } });
    const found = await prisma.company.findMany({ where: { name: { contains: 'perez' } } });
    expect(found).toHaveLength(1);
  });
});
