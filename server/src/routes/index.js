// Monta todos los routers de la API bajo /api. Cada módulo se añade en su fase.
import { Router } from 'express';

export const apiRouter = Router();

apiRouter.get('/', (_req, res) => {
  res.json({ success: true, data: { name: 'CRM API', version: '0.1.0' } });
});
