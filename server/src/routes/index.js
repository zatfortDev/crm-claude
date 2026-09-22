// Monta todos los routers de la API bajo /api. Cada módulo se añade en su fase.
import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { usersRouter } from './users.routes.js';
import { rolesRouter, permissionsRouter } from './roles.routes.js';
import { authenticate, requireFreshPassword } from '../middleware/authenticate.js';

export const apiRouter = Router();

apiRouter.get('/', (_req, res) => {
  res.json({ success: true, data: { name: 'CRM API', version: '0.1.0' } });
});

// Autenticación: gestiona sus propios middlewares por endpoint.
apiRouter.use('/auth', authRouter);

// El resto de la API exige sesión válida y contraseña vigente.
apiRouter.use(authenticate, requireFreshPassword);

apiRouter.use('/users', usersRouter);
apiRouter.use('/roles', rolesRouter);
apiRouter.use('/permissions', permissionsRouter);
