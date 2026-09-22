// Empresas, contactos y notas (docs/testing.md § 5.4).
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma, resetDb } from '../helpers/db.js';
import { createAndLogin, createUser, authed } from '../helpers/auth.js';
import { expectApiError } from '../helpers/expect.js';

let app;
let admin;
let seller;

beforeAll(() => {
  app = createApp();
});

beforeEach(async () => {
  await resetDb();
  admin = await createAndLogin(app, { role: 'Admin' });
  seller = await createAndLogin(app, { role: 'Vendedor' });
});

afterAll(() => prisma.$disconnect());

const companyPayload = (overrides = {}) => ({
  name: 'Acme S.A.',
  legalName: 'Acme Sociedad Anónima',
  taxId: '30-12345678-9',
  industry: 'Tecnología',
  website: 'https://acme.example',
  email: 'info@acme.example',
  phone: '+54 11 4000-0000',
  addressLine: 'Av. Corrientes 1234',
  city: 'Buenos Aires',
  state: 'CABA',
  country: 'Argentina',
  postalCode: 'C1043',
  employeesRange: '51-200',
  description: 'Cliente estratégico',
  ...overrides,
});

const contactPayload = (overrides = {}) => ({
  firstName: 'Juan',
  lastName: 'Gómez',
  email: 'juan@acme.example',
  phone: '+54 11 5000-0000',
  jobTitle: 'CTO',
  ...overrides,
});

async function createCompany(session = admin, overrides = {}) {
  const res = await authed(request(app).post('/api/companies'), session.token).send(
    companyPayload(overrides),
  );
  expect(res.status).toBe(201);
  return res.body.data;
}

async function createContact(session = admin, overrides = {}) {
  const res = await authed(request(app).post('/api/contacts'), session.token).send(
    contactPayload(overrides),
  );
  expect(res.status).toBe(201);
  return res.body.data;
}

describe('Empresas — CRUD y validación', () => {
  it('crea una empresa con todos sus datos', async () => {
    const company = await createCompany();
    expect(company).toMatchObject({
      name: 'Acme S.A.',
      taxId: '30-12345678-9',
      city: 'Buenos Aires',
      isArchived: false,
    });
    expect(company.createdBy.id).toBe(admin.user.id);
  });

  it('exige el nombre y rechaza valores fuera de dominio o desconocidos', async () => {
    const sinNombre = await authed(request(app).post('/api/companies'), admin.token).send(
      companyPayload({ name: '' }),
    );
    expectApiError(sinNombre, 400, 'VALIDATION_ERROR');

    const rangoInvalido = await authed(request(app).post('/api/companies'), admin.token).send(
      companyPayload({ employeesRange: '5-7' }),
    );
    expectApiError(rangoInvalido, 400, 'VALIDATION_ERROR');

    const emailInvalido = await authed(request(app).post('/api/companies'), admin.token).send(
      companyPayload({ email: 'no-es-email' }),
    );
    expectApiError(emailInvalido, 400, 'VALIDATION_ERROR');

    const campoExtra = await authed(request(app).post('/api/companies'), admin.token).send({
      ...companyPayload(),
      createdById: 999,
    });
    expectApiError(campoExtra, 400, 'VALIDATION_ERROR');
  });

  it('rechaza un identificador fiscal duplicado entre empresas activas', async () => {
    await createCompany();
    const res = await authed(request(app).post('/api/companies'), admin.token).send(
      companyPayload({ name: 'Otra S.A.' }),
    );
    expectApiError(res, 409, 'CONFLICT');
  });

  it('permite reutilizar el identificador fiscal de una empresa archivada', async () => {
    const company = await createCompany();
    await authed(request(app).delete(`/api/companies/${company.id}`), admin.token);

    const res = await authed(request(app).post('/api/companies'), admin.token).send(
      companyPayload({ name: 'Acme Nueva S.A.' }),
    );
    expect(res.status).toBe(201);
  });

  it('edita una empresa y registra el cambio en la auditoría', async () => {
    const company = await createCompany();
    const res = await authed(request(app).put(`/api/companies/${company.id}`), admin.token).send(
      companyPayload({ name: 'Acme Global S.A.', city: 'Córdoba' }),
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'Acme Global S.A.', city: 'Córdoba' });

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'Company', entityId: company.id, action: 'UPDATE' },
    });
    expect(JSON.parse(audit.changes).after.name).toBe('Acme Global S.A.');
  });

  it('devuelve 404 para una empresa inexistente', async () => {
    expectApiError(
      await authed(request(app).get('/api/companies/9999'), admin.token),
      404,
      'NOT_FOUND',
    );
  });
});

describe('Empresas — búsqueda y filtros', () => {
  beforeEach(async () => {
    await createCompany(admin, {
      name: 'Pérez Hnos.',
      taxId: '30-1',
      city: 'Rosario',
      industry: 'Retail',
    });
    await createCompany(admin, {
      name: 'Beta Corp',
      taxId: '30-2',
      city: 'Buenos Aires',
      industry: 'Tecnología',
    });
    await createCompany(admin, {
      name: 'Gamma SRL',
      taxId: '30-3',
      city: 'Buenos Aires',
      industry: 'Salud',
    });
  });

  it('busca sin distinguir mayúsculas ni acentos', async () => {
    const res = await authed(request(app).get('/api/companies?search=perez'), admin.token);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Pérez Hnos.');
  });

  it('filtra por ciudad e industria y pagina', async () => {
    const porCiudad = await authed(
      request(app).get('/api/companies?city=Buenos%20Aires'),
      admin.token,
    );
    expect(porCiudad.body.meta.total).toBe(2);

    const porIndustria = await authed(
      request(app).get('/api/companies?industry=Salud'),
      admin.token,
    );
    expect(porIndustria.body.data).toHaveLength(1);

    const paginado = await authed(
      request(app).get('/api/companies?pageSize=2&page=2'),
      admin.token,
    );
    expect(paginado.body.data).toHaveLength(1);
    expect(paginado.body.meta).toMatchObject({ page: 2, pageSize: 2, total: 3, totalPages: 2 });
  });

  it('ordena por nombre', async () => {
    const res = await authed(
      request(app).get('/api/companies?sortBy=name&sortOrder=asc'),
      admin.token,
    );
    expect(res.body.data.map((c) => c.name)).toEqual(['Beta Corp', 'Gamma SRL', 'Pérez Hnos.']);
  });

  it('excluye las archivadas salvo que se pidan con permiso', async () => {
    const [first] = (await authed(request(app).get('/api/companies'), admin.token)).body.data;
    await authed(request(app).delete(`/api/companies/${first.id}`), admin.token);

    const porDefecto = await authed(request(app).get('/api/companies'), admin.token);
    expect(porDefecto.body.meta.total).toBe(2);

    const conArchivadas = await authed(
      request(app).get('/api/companies?includeDeleted=true'),
      admin.token,
    );
    expect(conArchivadas.body.meta.total).toBe(3);

    // El Vendedor no tiene companies:delete: el parámetro se ignora.
    const comoVendedor = await authed(
      request(app).get('/api/companies?includeDeleted=true'),
      seller.token,
    );
    expect(comoVendedor.body.meta.total).toBe(2);
  });
});

describe('Empresas — archivar y restaurar', () => {
  it('archiva y restaura una empresa', async () => {
    const company = await createCompany();

    const archived = await authed(request(app).delete(`/api/companies/${company.id}`), admin.token);
    expect(archived.status).toBe(200);
    expect(archived.body.data.isArchived).toBe(true);

    const restored = await authed(
      request(app).post(`/api/companies/${company.id}/restore`),
      admin.token,
    );
    expect(restored.status).toBe(200);
    expect(restored.body.data.isArchived).toBe(false);
  });

  it('no archiva una empresa con un cliente activo', async () => {
    const company = await createCompany();
    await prisma.client.create({
      data: {
        type: 'COMPANY',
        companyId: company.id,
        status: 'ACTIVE',
        createdById: admin.user.id,
      },
    });

    const res = await authed(request(app).delete(`/api/companies/${company.id}`), admin.token);
    expect(expectApiError(res, 422, 'BUSINESS_RULE').details.rule).toBe(
      'COMPANY_HAS_ACTIVE_CLIENT',
    );
  });

  it('no archiva una empresa con oportunidades abiertas', async () => {
    const company = await createCompany();
    const client = await prisma.client.create({
      data: {
        type: 'COMPANY',
        companyId: company.id,
        status: 'INACTIVE',
        createdById: admin.user.id,
      },
    });
    const stage = await prisma.pipelineStage.findFirstOrThrow({
      where: { isWon: false, isLost: false },
    });
    await prisma.opportunity.create({
      data: {
        name: 'Negocio abierto',
        clientId: client.id,
        stageId: stage.id,
        ownerId: admin.user.id,
        createdById: admin.user.id,
        probability: stage.defaultProbability,
      },
    });

    const res = await authed(request(app).delete(`/api/companies/${company.id}`), admin.token);
    expect(expectApiError(res, 422, 'BUSINESS_RULE').details.rule).toBe(
      'COMPANY_HAS_OPEN_OPPORTUNITIES',
    );
  });

  it('un Vendedor no puede archivar ni restaurar', async () => {
    const company = await createCompany();
    expectApiError(
      await authed(request(app).delete(`/api/companies/${company.id}`), seller.token),
      403,
      'FORBIDDEN',
    );
  });
});

describe('Contactos', () => {
  it('crea un contacto asociado a una empresa y lo marca como principal', async () => {
    const company = await createCompany();
    const contact = await createContact(admin, { companyId: company.id, isPrimary: true });

    expect(contact).toMatchObject({
      fullName: 'Juan Gómez',
      isPrimary: true,
      company: { id: company.id, name: 'Acme S.A.' },
    });
  });

  it('mantiene un único contacto principal por empresa', async () => {
    const company = await createCompany();
    const first = await createContact(admin, { companyId: company.id, isPrimary: true });
    const second = await createContact(admin, {
      companyId: company.id,
      isPrimary: true,
      email: 'ana@acme.example',
      firstName: 'Ana',
      lastName: 'Pérez',
    });

    expect(second.isPrimary).toBe(true);
    const stored = await prisma.contact.findUniqueOrThrow({ where: { id: first.id } });
    expect(stored.isPrimary).toBe(false);
  });

  it('rechaza un email duplicado entre contactos activos', async () => {
    await createContact();
    const res = await authed(request(app).post('/api/contacts'), admin.token).send(
      contactPayload({ firstName: 'Otro' }),
    );
    expectApiError(res, 409, 'CONFLICT');
  });

  it('permite varios contactos sin email', async () => {
    await createContact(admin, { email: '' });
    const res = await authed(request(app).post('/api/contacts'), admin.token).send(
      contactPayload({ email: '', firstName: 'Ana', lastName: 'Ruiz' }),
    );
    expect(res.status).toBe(201);
    expect(res.body.data.email).toBeNull();
  });

  it('rechaza una empresa inexistente', async () => {
    const res = await authed(request(app).post('/api/contacts'), admin.token).send(
      contactPayload({ companyId: 9999 }),
    );
    const error = expectApiError(res, 400, 'VALIDATION_ERROR');
    expect(error.details[0].field).toBe('companyId');
  });

  it('al cambiar de empresa deja de ser principal de la anterior', async () => {
    const first = await createCompany();
    const second = await createCompany(admin, { name: 'Beta Corp', taxId: '30-999' });
    const contact = await createContact(admin, { companyId: first.id, isPrimary: true });

    const res = await authed(request(app).put(`/api/contacts/${contact.id}`), admin.token).send(
      contactPayload({ companyId: second.id }),
    );

    expect(res.status).toBe(200);
    expect(res.body.data.company.id).toBe(second.id);
    expect(res.body.data.isPrimary).toBe(false);
  });

  it('lista los contactos de una empresa', async () => {
    const company = await createCompany();
    await createContact(admin, { companyId: company.id });
    await createContact(admin, {
      companyId: company.id,
      email: 'ana@acme.example',
      firstName: 'Ana',
      lastName: 'Ruiz',
    });
    await createContact(admin, {
      email: 'suelto@test.local',
      firstName: 'Sin',
      lastName: 'Empresa',
    });

    const res = await authed(
      request(app).get(`/api/companies/${company.id}/contacts`),
      admin.token,
    );
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(2);
  });

  it('no archiva el contacto principal de un cliente activo', async () => {
    const company = await createCompany();
    const contact = await createContact(admin, { companyId: company.id, isPrimary: true });
    await prisma.client.create({
      data: {
        type: 'COMPANY',
        companyId: company.id,
        primaryContactId: contact.id,
        status: 'ACTIVE',
        createdById: admin.user.id,
      },
    });

    const res = await authed(request(app).delete(`/api/contacts/${contact.id}`), admin.token);
    expect(expectApiError(res, 422, 'BUSINESS_RULE').details.rule).toBe(
      'CONTACT_IS_PRIMARY_OF_CLIENT',
    );
  });

  it('un Vendedor puede crear y editar contactos pero no archivarlos', async () => {
    const contact = await createContact(seller, { email: 'vendedor@test.local' });
    const edit = await authed(request(app).put(`/api/contacts/${contact.id}`), seller.token).send(
      contactPayload({ email: 'vendedor@test.local', jobTitle: 'CEO' }),
    );
    expect(edit.status).toBe(200);

    expectApiError(
      await authed(request(app).delete(`/api/contacts/${contact.id}`), seller.token),
      403,
      'FORBIDDEN',
    );
  });
});

describe('Notas y timeline', () => {
  it('agrega notas a una empresa y muestra primero las fijadas', async () => {
    const company = await createCompany();

    await authed(request(app).post('/api/notes'), admin.token).send({
      content: 'Primera reunión pendiente',
      companyId: company.id,
    });
    const pinned = await authed(request(app).post('/api/notes'), admin.token).send({
      content: 'Contacto preferido: email',
      companyId: company.id,
      isPinned: true,
    });
    expect(pinned.status).toBe(201);

    const res = await authed(request(app).get(`/api/companies/${company.id}/notes`), admin.token);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].isPinned).toBe(true);
    expect(res.body.data[0].author.id).toBe(admin.user.id);
  });

  it('exige exactamente una entidad padre', async () => {
    const company = await createCompany();
    const contact = await createContact();

    const sinPadre = await authed(request(app).post('/api/notes'), admin.token).send({
      content: 'Suelta',
    });
    expectApiError(sinPadre, 400, 'VALIDATION_ERROR');

    const dosPadres = await authed(request(app).post('/api/notes'), admin.token).send({
      content: 'Ambigua',
      companyId: company.id,
      contactId: contact.id,
    });
    expectApiError(dosPadres, 400, 'VALIDATION_ERROR');
  });

  it('solo el autor o quien tenga notes:manage edita o borra una nota ajena', async () => {
    const company = await createCompany();
    const note = await authed(request(app).post('/api/notes'), seller.token).send({
      content: 'Nota del vendedor',
      companyId: company.id,
    });

    const otro = await createAndLogin(app, { role: 'Vendedor' });
    const ajena = await authed(
      request(app).put(`/api/notes/${note.body.data.id}`),
      otro.token,
    ).send({
      content: 'Editada por otro',
    });
    expectApiError(ajena, 403, 'FORBIDDEN');

    const propia = await authed(
      request(app).put(`/api/notes/${note.body.data.id}`),
      seller.token,
    ).send({ content: 'Editada por su autor' });
    expect(propia.status).toBe(200);

    // Admin tiene notes:manage.
    const borradoAdmin = await authed(
      request(app).delete(`/api/notes/${note.body.data.id}`),
      admin.token,
    );
    expect(borradoAdmin.status).toBe(204);
  });

  it('el timeline combina notas y auditoría en orden cronológico inverso', async () => {
    const company = await createCompany();
    await authed(request(app).put(`/api/companies/${company.id}`), admin.token).send(
      companyPayload({ name: 'Acme Renombrada' }),
    );
    await authed(request(app).post('/api/notes'), admin.token).send({
      content: 'Nota posterior',
      companyId: company.id,
    });

    const res = await authed(
      request(app).get(`/api/companies/${company.id}/timeline`),
      admin.token,
    );
    expect(res.status).toBe(200);
    expect(res.body.data[0].kind).toBe('note');

    const kinds = res.body.data.map((entry) => entry.kind);
    expect(kinds).toContain('audit');
    const update = res.body.data.find((entry) => entry.payload.action === 'UPDATE');
    expect(update.payload.changes.after.name).toBe('Acme Renombrada');

    const fechas = res.body.data.map((entry) => new Date(entry.at).getTime());
    expect(fechas).toEqual([...fechas].sort((a, b) => b - a));
  });

  it('el timeline de un contacto registra su creación', async () => {
    const contact = await createContact();
    const res = await authed(request(app).get(`/api/contacts/${contact.id}/timeline`), admin.token);
    expect(res.status).toBe(200);
    expect(res.body.data.some((entry) => entry.payload.action === 'CREATE')).toBe(true);
  });
});

describe('Permisos del módulo', () => {
  it('un rol sin permisos de empresas recibe 403', async () => {
    const role = await prisma.role.create({ data: { name: 'Sin acceso', isSystem: false } });
    const user = await createUser({ role: 'Vendedor' });
    await prisma.user.update({ where: { id: user.id }, data: { roleId: role.id } });
    const session = await createAndLogin(app, { role: 'Vendedor' });
    await prisma.user.update({ where: { id: session.user.id }, data: { roleId: role.id } });

    expectApiError(
      await authed(request(app).get('/api/companies'), session.token),
      403,
      'FORBIDDEN',
    );
  });

  it('todas las rutas del módulo exigen autenticación', async () => {
    for (const path of ['/api/companies', '/api/contacts']) {
      expectApiError(await request(app).get(path), 401, 'UNAUTHORIZED');
    }
  });
});
