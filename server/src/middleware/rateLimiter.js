import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const common = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.isTest,
  handler: (_req, _res, next) => next(ApiError.rateLimited()),
  keyGenerator: (req) => ipKeyGenerator(req.ip),
};

/** Límite global por IP. */
export const globalRateLimiter = rateLimit({
  ...common,
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
});

/** Límite estricto para login (fuerza bruta). */
export const loginRateLimiter = rateLimit({
  ...common,
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.LOGIN_RATE_LIMIT_MAX,
  handler: (_req, _res, next) =>
    next(ApiError.rateLimited('Demasiados intentos de inicio de sesión, intentá más tarde')),
});
