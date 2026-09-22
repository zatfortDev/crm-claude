// Utilidades de base de datos para tests de integración.
import { prisma } from '../../src/lib/prisma.js';
import { runSeed } from '../../prisma/seed.js';
import { invalidatePermissionCache } from '../../src/services/permission.service.js';

// Orden seguro respecto de las FKs (hijos antes que padres). Los catálogos
// (Permission, PipelineStage, LeadSource, Setting) se conservan y se re-siembran.
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

  // Los roles personalizados creados por un test no deben sobrevivir al siguiente.
  const customRoles = await prisma.role.findMany({
    where: { isSystem: false },
    select: { id: true },
  });
  if (customRoles.length > 0) {
    const ids = customRoles.map((role) => role.id);
    await prisma.rolePermission.deleteMany({ where: { roleId: { in: ids } } });
    await prisma.role.deleteMany({ where: { id: { in: ids } } });
  }

  // La caché de permisos por rol quedaría desfasada tras re-sembrar.
  invalidatePermissionCache();
  return runSeed();
}

export { prisma };
