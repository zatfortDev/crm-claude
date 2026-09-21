// Carga y validación de variables de entorno.
// Ningún otro módulo debe leer process.env directamente: importar `env` desde aquí.
// Si falta una variable obligatoria el proceso termina con un mensaje claro (fallar rápido).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// dotenv no sobrescribe variables ya definidas (útil en CI y en tests).
dotenv.config({ path: path.join(serverRoot, '.env'), quiet: true });

const booleanFromString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const csv = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  TRUST_PROXY: booleanFromString,
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  TEST_DATABASE_URL: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().int().positive().default(7),
  COOKIE_SECURE: booleanFromString,
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  LOCKOUT_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),

  CORS_ORIGINS: csv,

  RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
  SEED_ADMIN_FIRST_NAME: z.string().default('Admin'),
  SEED_ADMIN_LAST_NAME: z.string().default('Sistema'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map(
    (issue) => `  - ${issue.path.join('.')}: ${issue.message}`,
  );
  console.error(`Configuración inválida (.env):\n${issues.join('\n')}`);
  process.exit(1);
}

const values = parsed.data;

// En tests se usa siempre la base de test; nunca la de desarrollo.
if (values.NODE_ENV === 'test') {
  if (!values.TEST_DATABASE_URL) {
    console.error('TEST_DATABASE_URL es obligatoria cuando NODE_ENV=test');
    process.exit(1);
  }
  if (!/_test\b/i.test(values.TEST_DATABASE_URL)) {
    console.error('TEST_DATABASE_URL debe apuntar a una base cuyo nombre contenga "_test"');
    process.exit(1);
  }
  values.DATABASE_URL = values.TEST_DATABASE_URL;
}

export const env = Object.freeze({
  ...values,
  isProduction: values.NODE_ENV === 'production',
  isTest: values.NODE_ENV === 'test',
  isDevelopment: values.NODE_ENV === 'development',
});
