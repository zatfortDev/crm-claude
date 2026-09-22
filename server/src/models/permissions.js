// Catálogo de permisos y matriz de roles del sistema (docs/security.md § 4).
// Formato: "modulo:accion". Se siembra en la base y se usa en authorize().

const define = (module, actions, descriptions = {}) =>
  actions.map((action) => ({
    code: `${module}:${action}`,
    module,
    description: descriptions[action] ?? `${module}: ${action}`,
  }));

const OWNED = ['read', 'read_all', 'create', 'update', 'update_all', 'delete', 'assign'];

export const PERMISSIONS = [
  ...define('users', ['read', 'create', 'update', 'manage'], {
    manage: 'Activar/desactivar, cambiar rol y resetear contraseña',
  }),
  ...define('roles', ['read', 'manage']),
  ...define('companies', ['read', 'create', 'update', 'delete'], {
    delete: 'Archivar y restaurar',
  }),
  ...define('contacts', ['read', 'create', 'update', 'delete'], { delete: 'Archivar y restaurar' }),
  ...define('clients', OWNED),
  ...define('leads', [...OWNED, 'convert']),
  ...define('opportunities', [...OWNED, 'reopen']),
  ...define('activities', [
    'read',
    'read_all',
    'create',
    'update',
    'update_all',
    'delete',
    'delete_all',
  ]),
  ...define('notes', ['create', 'update', 'delete', 'manage'], {
    manage: 'Editar y borrar notas ajenas',
  }),
  ...define('dashboard', ['view', 'view_all']),
  ...define('reports', ['view', 'view_all', 'export']),
  ...define('settings', ['read', 'manage']),
  ...define('audit', ['read']),
];

export const PERMISSION_CODES = PERMISSIONS.map((p) => p.code);

const codesOf = (prefixes) =>
  PERMISSION_CODES.filter((code) => prefixes.some((p) => code.startsWith(p)));

/** Vendedor: solo registros propios; directorio compartido sin borrado. */
const SALES_PERMISSIONS = [
  'companies:read',
  'companies:create',
  'companies:update',
  'contacts:read',
  'contacts:create',
  'contacts:update',
  'clients:read',
  'clients:create',
  'clients:update',
  'leads:read',
  'leads:create',
  'leads:update',
  'leads:convert',
  'opportunities:read',
  'opportunities:create',
  'opportunities:update',
  'activities:read',
  'activities:create',
  'activities:update',
  'activities:delete',
  'notes:create',
  'notes:update',
  'notes:delete',
  'dashboard:view',
  'reports:view',
  'settings:read',
];

/** Manager: todo salvo administración de usuarios/roles, configuración y auditoría. */
const MANAGER_PERMISSIONS = PERMISSION_CODES.filter(
  (code) =>
    !code.startsWith('users:') &&
    !code.startsWith('roles:') &&
    code !== 'settings:manage' &&
    code !== 'audit:read',
);

export const ROLE_PERMISSIONS = Object.freeze({
  Admin: PERMISSION_CODES,
  Manager: MANAGER_PERMISSIONS,
  Vendedor: SALES_PERMISSIONS,
});

export const SYSTEM_ROLE_DEFINITIONS = [
  { name: 'Admin', description: 'Administra usuarios, roles, configuración y auditoría' },
  {
    name: 'Manager',
    description: 'Supervisa clientes, leads, oportunidades, actividades y vendedores',
  },
  {
    name: 'Vendedor',
    description: 'Gestiona sus propios clientes, leads, oportunidades y actividades',
  },
];

// Comprobación defensiva: todo permiso asignado debe existir en el catálogo.
for (const [role, codes] of Object.entries(ROLE_PERMISSIONS)) {
  for (const code of codes) {
    if (!PERMISSION_CODES.includes(code))
      throw new Error(`Permiso desconocido en rol ${role}: ${code}`);
  }
}

export { codesOf };
