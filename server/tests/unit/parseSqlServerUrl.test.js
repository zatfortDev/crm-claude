import { describe, it, expect } from 'vitest';
import { parseSqlServerUrl } from '../../src/lib/prisma.js';

describe('parseSqlServerUrl', () => {
  it('parsea host, puerto, base y credenciales', () => {
    const cfg = parseSqlServerUrl(
      'sqlserver://localhost:1433;database=crm_dev;user=crm_dev;password=s3cret;encrypt=true;trustServerCertificate=true',
    );
    expect(cfg.server).toBe('localhost');
    expect(cfg.port).toBe(1433);
    expect(cfg.database).toBe('crm_dev');
    expect(cfg.user).toBe('crm_dev');
    expect(cfg.password).toBe('s3cret');
    expect(cfg.options.encrypt).toBe(true);
    expect(cfg.options.trustServerCertificate).toBe(true);
  });

  it('soporta valores entre llaves con caracteres especiales', () => {
    const cfg = parseSqlServerUrl('sqlserver://db;database=crm;user=u;password={p;ss=w}');
    expect(cfg.password).toBe('p;ss=w');
    expect(cfg.port).toBe(1433);
  });

  it('soporta instancias nombradas', () => {
    const cfg = parseSqlServerUrl(
      'sqlserver://localhost\\SQLEXPRESS;database=crm;user=u;password=p',
    );
    expect(cfg.server).toBe('localhost');
    expect(cfg.options.instanceName).toBe('SQLEXPRESS');
    expect(cfg.port).toBeUndefined();
  });

  it('rechaza integratedSecurity con un mensaje claro', () => {
    expect(() =>
      parseSqlServerUrl('sqlserver://localhost;database=crm;integratedSecurity=true'),
    ).toThrow(/integratedSecurity/);
  });

  it('rechaza URLs que no son sqlserver://', () => {
    expect(() => parseSqlServerUrl('postgresql://x')).toThrow(/sqlserver/);
  });
});
