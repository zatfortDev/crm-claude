// Cliente Prisma (singleton) conectado a SQL Server mediante el driver adapter oficial.
// Prisma 7 exige un adapter; @prisma/adapter-mssql usa el paquete `mssql` (tedious), que
// acepta su propia configuración, no la URL `sqlserver://` de Prisma. Para mantener UNA sola
// fuente de verdad (DATABASE_URL, también usada por la CLI de migraciones) se parsea aquí.
import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../generated/prisma/client.ts';
import { env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * Convierte una URL Prisma `sqlserver://HOST[:PORT];key=value;...` en la configuración de `mssql`.
 * Soporta valores entre llaves `{...}` para caracteres especiales (`;`, `=`).
 */
export function parseSqlServerUrl(url) {
  const prefix = 'sqlserver://';
  if (!url?.startsWith(prefix)) {
    throw new Error('DATABASE_URL debe comenzar con "sqlserver://"');
  }

  // Divide por ';' respetando valores entre llaves, que pueden contener ';' o '='.
  const segments = [];
  let current = '';
  let depth = 0;
  for (const ch of url.slice(prefix.length)) {
    if (ch === '{') depth += 1;
    else if (ch === '}') depth = Math.max(0, depth - 1);
    if (ch === ';' && depth === 0) {
      segments.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  segments.push(current);

  const [hostPart, ...pairs] = segments;
  const params = {};
  for (const pair of pairs) {
    if (!pair.trim()) continue;
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const key = pair.slice(0, eq).trim().toLowerCase();
    let value = pair.slice(eq + 1).trim();
    if (value.startsWith('{') && value.endsWith('}')) value = value.slice(1, -1);
    params[key] = value;
  }

  if (params.integratedsecurity === 'true') {
    throw new Error(
      'integratedSecurity no está soportado por el driver de la aplicación (tedious). ' +
        'Usá un login SQL: user=...;password=... (docs/database.md § 8).',
    );
  }

  // HOST puede ser "host", "host:puerto" o "host\instancia"
  let server = hostPart;
  let port;
  let instanceName;
  const backslash = hostPart.indexOf('\\');
  if (backslash !== -1) {
    server = hostPart.slice(0, backslash);
    instanceName = hostPart.slice(backslash + 1);
  } else {
    const colon = hostPart.lastIndexOf(':');
    if (colon !== -1) {
      server = hostPart.slice(0, colon);
      port = Number(hostPart.slice(colon + 1));
    }
  }

  const toBool = (value, fallback) => (value === undefined ? fallback : value === 'true');

  return {
    server,
    port: port ?? (instanceName ? undefined : 1433),
    database: params.database,
    user: params.user ?? params.username,
    password: params.password,
    connectionTimeout: Number(params.connecttimeout ?? 5) * 1000,
    requestTimeout: 30_000,
    pool: {
      max: Number(params.connection_limit ?? 10),
      min: 0,
      idleTimeoutMillis: 30_000,
    },
    options: {
      encrypt: toBool(params.encrypt, true),
      trustServerCertificate: toBool(params.trustservercertificate, false),
      instanceName,
      useUTC: true,
      enableArithAbort: true,
    },
  };
}

function createPrismaClient() {
  const adapter = new PrismaMssql(parseSqlServerUrl(env.DATABASE_URL));
  return new PrismaClient({
    adapter,
    log: env.isDevelopment
      ? [
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ]
      : [],
  });
}

// Evita múltiples instancias con `node --watch` / recargas en desarrollo.
const globalRef = globalThis;
export const prisma = globalRef.__crmPrisma ?? createPrismaClient();
if (!env.isProduction) globalRef.__crmPrisma = prisma;

if (typeof prisma.$on === 'function' && env.isDevelopment) {
  prisma.$on('warn', (event) => logger.warn({ prisma: event }, 'Prisma warning'));
  prisma.$on('error', (event) => logger.error({ prisma: event }, 'Prisma error'));
}

/** Comprueba la conectividad con la base (usado por /health y al arrancar). */
export async function checkDatabaseConnection() {
  await prisma.$queryRaw`SELECT 1 AS ok`;
}
