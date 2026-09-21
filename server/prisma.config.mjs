// Configuración de Prisma 7 (CLI: generate, migrate, studio, seed).
// La URL de conexión ya no vive en schema.prisma sino aquí (docs/database.md § 1.1).
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// `prisma generate` no necesita conexión: si falta DATABASE_URL (p. ej. en un clon reciente
// o en el build de Docker) se usa un placeholder y solo fallan los comandos que sí la requieren.
const url = process.env.DATABASE_URL ?? 'sqlserver://localhost:1433;database=crm_dev';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.js',
  },
  datasource: {
    url,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
