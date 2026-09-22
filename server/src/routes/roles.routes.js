import { Router } from 'express';
import * as controller from '../controllers/roles.controller.js';
import { validate } from '../middleware/validate.js';
import { authorize } from '../middleware/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { idParamSchema } from '../validators/common.validators.js';
import { roleBodySchema } from '../validators/roles.validators.js';

export const rolesRouter = Router();

rolesRouter.get('/', authorize('roles:read'), asyncHandler(controller.list));
rolesRouter.get(
  '/:id',
  authorize('roles:read'),
  validate({ params: idParamSchema }),
  asyncHandler(controller.getById),
);
rolesRouter.post(
  '/',
  authorize('roles:manage'),
  validate({ body: roleBodySchema }),
  asyncHandler(controller.create),
);
rolesRouter.put(
  '/:id',
  authorize('roles:manage'),
  validate({ params: idParamSchema, body: roleBodySchema }),
  asyncHandler(controller.update),
);
rolesRouter.delete(
  '/:id',
  authorize('roles:manage'),
  validate({ params: idParamSchema }),
  asyncHandler(controller.remove),
);

// Catálogo de permisos (se monta aparte en /api/permissions).
export const permissionsRouter = Router();
permissionsRouter.get('/', authorize('roles:read'), asyncHandler(controller.listPermissions));
