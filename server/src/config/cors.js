import { env } from './env.js';

/** Opciones de CORS: lista blanca explícita de orígenes (docs/security.md § 6). */
export const corsOptions = {
  origin(origin, callback) {
    // Sin cabecera Origin (curl, health checks, same-origin) se permite.
    if (!origin || env.CORS_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id', 'Content-Disposition'],
  maxAge: 600,
};
