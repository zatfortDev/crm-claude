import { checkDatabaseConnection } from '../lib/prisma.js';
import { env } from '../config/env.js';

const startedAt = Date.now();

/** GET /health — estado de la aplicación y de la base de datos. */
export async function getHealth(_req, res) {
  let db = 'ok';
  try {
    await checkDatabaseConnection();
  } catch {
    db = 'error';
  }
  const status = db === 'ok' ? 'ok' : 'degraded';
  res.status(db === 'ok' ? 200 : 503).json({
    status,
    db,
    uptime: Math.round((Date.now() - startedAt) / 1000),
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
}
