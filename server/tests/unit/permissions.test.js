import { describe, it, expect } from 'vitest';
import { PERMISSIONS, PERMISSION_CODES, ROLE_PERMISSIONS } from '../../src/models/permissions.js';
import { LEAD_TRANSITIONS, LEAD_STATUSES } from '../../src/models/constants.js';

describe('catálogo de permisos', () => {
  it('no tiene códigos duplicados y todos siguen el formato modulo:accion', () => {
    expect(new Set(PERMISSION_CODES).size).toBe(PERMISSIONS.length);
    for (const code of PERMISSION_CODES) expect(code).toMatch(/^[a-z]+:[a-z_]+$/);
  });

  it('Admin tiene todos los permisos', () => {
    expect(ROLE_PERMISSIONS.Admin).toEqual(PERMISSION_CODES);
  });

  it('Manager no administra usuarios, roles, configuración ni auditoría', () => {
    const forbidden = ROLE_PERMISSIONS.Manager.filter(
      (c) =>
        c.startsWith('users:') ||
        c.startsWith('roles:') ||
        c === 'settings:manage' ||
        c === 'audit:read',
    );
    expect(forbidden).toEqual([]);
    expect(ROLE_PERMISSIONS.Manager).toContain('clients:read_all');
    expect(ROLE_PERMISSIONS.Manager).toContain('leads:assign');
  });

  it('Vendedor solo tiene alcance propio y no borra registros del directorio', () => {
    const sales = ROLE_PERMISSIONS.Vendedor;
    expect(sales.some((c) => c.endsWith('_all'))).toBe(false);
    expect(sales).not.toContain('companies:delete');
    expect(sales).not.toContain('clients:assign');
    expect(sales).toContain('leads:convert');
    expect(sales).toContain('dashboard:view');
  });
});

describe('transiciones de lead', () => {
  it('cubre todos los estados y CONVERTED es terminal', () => {
    expect(Object.keys(LEAD_TRANSITIONS).sort()).toEqual([...LEAD_STATUSES].sort());
    expect(LEAD_TRANSITIONS.CONVERTED).toEqual([]);
  });

  it('LOST y UNQUALIFIED solo pueden volver a NEW', () => {
    expect(LEAD_TRANSITIONS.LOST).toEqual(['NEW']);
    expect(LEAD_TRANSITIONS.UNQUALIFIED).toEqual(['NEW']);
  });
});
