// Monta todos los routers de la API bajo /api. Cada módulo se añade en su fase.
// La autenticación se aplica por router (no con un `use` global) para que una ruta
// inexistente siga devolviendo 404 y no 401 (docs/api.md § 20).
import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { usersRouter } from './users.routes.js';
import { rolesRouter, permissionsRouter } from './roles.routes.js';
import { companiesRouter } from './companies.routes.js';
import { contactsRouter } from './contacts.routes.js';
import { notesRouter } from './notes.routes.js';
import { authenticate, requireFreshPassword } from '../middleware/authenticate.js';

export const apiRouter = Router();

apiRouter.get('/', (_req, res) => {
  res.json({ success: true, data: { name: 'CRM API', version: '0.1.0' } });
});

// Autenticación: gestiona sus propios middlewares por endpoint.
apiRouter.use('/auth', authRouter);

/** Router protegido: exige sesión válida y contraseña vigente. */
const secured = [authenticate, requireFreshPassword];

apiRouter.use('/users', secured, usersRouter);
apiRouter.use('/roles', secured, rolesRouter);
apiRouter.use('/permissions', secured, permissionsRouter);
apiRouter.use('/companies', secured, companiesRouter);
apiRouter.use('/contacts', secured, contactsRouter);
apiRouter.use('/notes', secured, notesRouter);
