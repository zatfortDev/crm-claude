import { expect } from 'vitest';

/** Verifica el formato uniforme de error de la API. */
export function expectApiError(res, status, code) {
  expect(res.status).toBe(status);
  expect(res.body.success).toBe(false);
  if (code) expect(res.body.error.code).toBe(code);
  return res.body.error;
}
