// Seed idempotente: roles del sistema, catálogo de permisos, etapas del pipeline,
// fuentes de leads, configuración general y administrador inicial (docs/database.md § 7).
// Ejecutar: npm run db:seed  (requiere SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD en .env la primera vez)
import { pathToFileURL } from 'node:url';
import bcrypt from 'bcrypt';
import { env } from '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  SYSTEM_ROLE_DEFINITIONS,
} from '../src/models/permissions.js';

const PIPELINE_STAGES = [
  { name: 'Prospecto', sortOrder: 1, defaultProbability: 10, color: '#64748b' },
  { name: 'Contactado', sortOrder: 2, defaultProbability: 25, color: '#3b82f6' },
  { name: 'Propuesta', sortOrder: 3, defaultProbability: 50, color: '#8b5cf6' },
  { name: 'Negociación', sortOrder: 4, defaultProbability: 75, color: '#f59e0b' },
  { name: 'Ganada', sortOrder: 5, defaultProbability: 100, color: '#22c55e', isWon: true },
  { name: 'Perdida', sortOrder: 6, defaultProbability: 0, color: '#ef4444', isLost: true },
];

const LEAD_SOURCES = [
  'Sitio web',
  'Referido',
  'Redes sociales',
  'Llamada en frío',
  'Evento',
  'Email',
  'Publicidad',
  'Otro',
];

const SETTINGS = {
  company_name: 'Mi Empresa',
  default_currency: 'USD',
  timezone: 'America/Argentina/Buenos_Aires',
  date_format: 'DD/MM/YYYY',
};

async function seedPermissions() {
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { module: permission.module, description: permission.description },
      create: permission,
    });
  }
  return prisma.permission.findMany({ select: { id: true, code: true } });
}

async function seedRoles(permissions) {
  const byCode = new Map(permissions.map((p) => [p.code, p.id]));
  const roles = {};
  for (const definition of SYSTEM_ROLE_DEFINITIONS) {
    const role = await prisma.role.upsert({
      where: { name: definition.name },
      update: { description: definition.description, isSystem: true },
      create: { ...definition, isSystem: true },
    });
    roles[role.name] = role;

    // Los roles del sistema reciben exactamente la matriz definida en código.
    const codes = ROLE_PERMISSIONS[definition.name];
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: codes.map((code) => ({ roleId: role.id, permissionId: byCode.get(code) })),
    });
  }
  return roles;
}

async function seedPipelineStages() {
  for (const stage of PIPELINE_STAGES) {
    await prisma.pipelineStage.upsert({
      where: { name: stage.name },
      update: {},
      create: stage,
    });
  }
}

async function seedLeadSources() {
  for (const [index, name] of LEAD_SOURCES.entries()) {
    await prisma.leadSource.upsert({
      where: { name },
      update: {},
      create: { name, sortOrder: index + 1 },
    });
  }
}

async function seedSettings() {
  for (const [key, value] of Object.entries(SETTINGS)) {
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
}

async function seedAdmin(roles) {
  const existingAdmins = await prisma.user.count({
    where: { roleId: roles.Admin.id, isActive: true },
  });
  if (existingAdmins > 0) {
    console.log('Ya existe al menos un administrador activo; no se crea otro.');
    return;
  }
  if (!env.SEED_ADMIN_EMAIL || !env.SEED_ADMIN_PASSWORD) {
    throw new Error(
      'Definí SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD en server/.env para crear el primer administrador',
    );
  }
  if (env.SEED_ADMIN_PASSWORD.length < 10) {
    throw new Error('SEED_ADMIN_PASSWORD debe tener al menos 10 caracteres');
  }
  const passwordHash = await bcrypt.hash(env.SEED_ADMIN_PASSWORD, env.BCRYPT_ROUNDS);
  await prisma.user.create({
    data: {
      email: env.SEED_ADMIN_EMAIL.toLowerCase(),
      passwordHash,
      firstName: env.SEED_ADMIN_FIRST_NAME,
      lastName: env.SEED_ADMIN_LAST_NAME,
      roleId: roles.Admin.id,
      mustChangePassword: true,
    },
  });
  console.log(
    `Administrador inicial creado: ${env.SEED_ADMIN_EMAIL} (debe cambiar la contraseña al ingresar)`,
  );
}

export async function runSeed() {
  const permissions = await seedPermissions();
  const roles = await seedRoles(permissions);
  await seedPipelineStages();
  await seedLeadSources();
  await seedSettings();
  return roles;
}

async function main() {
  console.log(`Sembrando base de datos (${env.NODE_ENV})...`);
  const roles = await runSeed();
  await seedAdmin(roles);
  console.log('Seed completado.');
}

// Solo se ejecuta como script; los tests importan runSeed() directamente.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((err) => {
      console.error('Error en el seed:', err.message);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
