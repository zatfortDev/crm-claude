import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

let app;
beforeAll(() => {
  app = createApp();
});

describe('Aplicación base', () => {
  it('GET /api responde con el envoltorio de éxito', async () => {
    const res = await request(app).get('/api');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { name: 'CRM API' } });
  });

  it('rutas inexistentes devuelven 404 con formato uniforme', async () => {
    const res = await request(app).get('/api/no-existe');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
  });

  it('JSON malformado devuelve 400', async () => {
    const res = await request(app)
      .post('/api')
      .set('Content-Type', 'application/json')
      .send('{"a":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('incluye cabeceras de seguridad y X-Request-Id', async () => {
    const res = await request(app).get('/api');
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('rechaza orígenes no permitidos por CORS', async () => {
    const res = await request(app).get('/api').set('Origin', 'https://malicioso.example');
    expect(res.status).toBe(500); // el error de CORS no es ApiError: se responde como interno sin detalles
    expect(res.body.success).toBe(false);
  });

  it('GET /health informa el estado de la base (503 si no hay conexión)', async () => {
    const res = await request(app).get('/health');
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('db');
  });
});
