import { Router } from 'express';
import * as controller from '../controllers/users.controller.js';
import { validate } from '../middleware/validate.js';
import { authorize } from '../middleware/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { idParamSchema } from '../validators/common.validators.js';
import {
  listUsersQuerySchema,
  createUserSchema,
  updateUserSchema,
  setStatusSchema,
  setRoleSchema,
  resetPasswordSchema,
} from '../validators/users.validators.js';

export const usersRouter = Router();

// Disponible para cualquier usuario autenticado: alimenta los selectores de responsable.
usersRouter.get('/options', asyncHandler(controller.options));

usersRouter.get(
  '/',
  authorize('users:read'),
  validate({ query: listUsersQuerySchema }),
  asyncHandler(controller.list),
);
usersRouter.get(
  '/:id',
  authorize('users:read'),
  validate({ params: idParamSchema }),
  asyncHandler(controller.getById),
);
usersRouter.post(
  '/',
  authorize('users:create'),
  validate({ body: createUserSchema }),
  asyncHandler(controller.create),
);
usersRouter.put(
  '/:id',
  authorize('users:update'),
  validate({ params: idParamSchema, body: updateUserSchema }),
  asyncHandler(controller.update),
);
usersRouter.patch(
  '/:id/status',
  authorize('users:manage'),
  validate({ params: idParamSchema, body: setStatusSchema }),
  asyncHandler(controller.setStatus),
);
usersRouter.patch(
  '/:id/role',
  authorize('users:manage'),
  validate({ params: idParamSchema, body: setRoleSchema }),
  asyncHandler(controller.setRole),
);
usersRouter.post(
  '/:id/reset-password',
  authorize('users:manage'),
  validate({ params: idParamSchema, body: resetPasswordSchema }),
  asyncHandler(controller.resetPassword),
);
