import { describe, it, expect } from 'vitest';
import { ApiError } from '../../src/utils/ApiError.js';

describe('ApiError', () => {
  it('crea errores con status y código', () => {
    const err = ApiError.notFound();
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });

  it('businessRule incluye la regla en details', () => {
    const err = ApiError.businessRule(
      'LAST_ADMIN',
      'No se puede desactivar al último administrador',
    );
    expect(err.status).toBe(422);
    expect(err.details).toEqual({ rule: 'LAST_ADMIN' });
  });
});
