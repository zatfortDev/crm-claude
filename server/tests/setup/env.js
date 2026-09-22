// Variables para los tests. Se ejecuta antes de importar cualquier módulo de src/.
// 1) Carga server/.env (sin sobrescribir lo ya definido, p. ej. en CI).
// 2) Fuerza NODE_ENV=test y define valores mínimos para lo que falte.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(serverRoot, '.env'), quiet: true });

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET ??= 'test-secret-test-secret-test-secret-0123456789';
process.env.CORS_ORIGINS ??= 'http://localhost:5173';
// Placeholders solo para que config/env.js valide cuando no hay .env (tests sin base).
process.env.DATABASE_URL ??= 'sqlserver://localhost:1433;database=crm_dev;user=x;password=x';
process.env.TEST_DATABASE_URL ??= 'sqlserver://localhost:1433;database=crm_test;user=x;password=x';
