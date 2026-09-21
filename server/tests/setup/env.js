// Variables mínimas para los tests. Se ejecuta antes de importar cualquier módulo de src/.
// dotenv (config/env.js) NO sobrescribe estas variables.
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET ??= 'test-secret-test-secret-test-secret-0123456789';
process.env.CORS_ORIGINS ??= 'http://localhost:5173';
process.env.DATABASE_URL ??= 'sqlserver://localhost:1433;database=crm_dev;user=x;password=x';
process.env.TEST_DATABASE_URL ??= 'sqlserver://localhost:1433;database=crm_test;user=x;password=x';
