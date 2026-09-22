// Utilidades de base de datos para tests de integración.
import { prisma } from '../../src/lib/prisma.js';
import { runSeed } from '../../prisma/seed.js';

// Orden seguro respecto de las FKs (hijos antes que padres). Los catálogos
// (Role, Permission, PipelineStage, LeadSource, Setting) se conservan y se re-siembran.
const TABLES_IN_DELETE_ORDER = [
  'Note',
  'Activity',
  'OpportunityStageHistory',
  'Opportunity',
  'Lead',
  'Client',
  'Contact',
  'Company',
  'Notification',
  'AuditLog',
  'RefreshToken',
  'User',
];

/** Vacía los datos de negocio y vuelve a sembrar los catálogos. */
export async function resetDb() {
  // Lead referencia a Client/Contact/Opportunity y viceversa no; pero Lead.companyId → Company,
  // por eso Lead se borra antes que Company. Setting.updatedById → User: se anula antes.
  await prisma.$executeRawUnsafe('UPDATE [Setting] SET [updatedById] = NULL');
  for (const table of TABLES_IN_DELETE_ORDER) {
    await prisma.$executeRawUnsafe(`DELETE FROM [${table}]`);
  }
  return runSeed();
}

export { prisma };
