// Se ejecuta una vez por corrida de Vitest: aplica las migraciones sobre la base de test.
// Nunca toca crm_dev: exige que TEST_DATABASE_URL contenga "_test".
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export default function globalSetup() {
  dotenv.config({ path: path.join(serverRoot, '.env'), quiet: true });
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) throw new Error('TEST_DATABASE_URL no está definida (server/.env)');
  if (!/_test\b/i.test(testUrl))
    throw new Error('TEST_DATABASE_URL debe apuntar a una base "_test"');

  const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: serverRoot,
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: 'pipe',
    shell: true,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(
      `prisma migrate deploy falló en la base de test:\n${result.stdout}\n${result.stderr}`,
    );
  }
}
