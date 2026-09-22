// Logger de la aplicación (pino). JSON en producción, legible en desarrollo.
// `redact` evita que credenciales o tokens lleguen a los logs (docs/security.md § 7).
import pino from 'pino';
import { env } from '../config/env.js';

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.passwordHash',
  '*.newPassword',
  '*.currentPassword',
  '*.temporaryPassword',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
];

export const logger = pino({
  level: env.isTest ? 'silent' : env.LOG_LEVEL,
  redact: { paths: redactPaths, censor: '[REDACTED]' },
  base: { service: 'crm-api' },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: env.isDevelopment
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname,service' },
      }
    : undefined,
});
