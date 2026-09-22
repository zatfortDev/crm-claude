import { Router } from 'express';
import * as controller from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticate, requireFreshPassword } from '../middleware/authenticate.js';
import { loginRateLimiter } from '../middleware/rateLimiter.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  loginSchema,
  changePasswordSchema,
  updateProfileSchema,
} from '../validators/auth.validators.js';

export const authRouter = Router();

authRouter.post(
  '/login',
  loginRateLimiter,
  validate({ body: loginSchema }),
  asyncHandler(controller.login),
);
authRouter.post('/refresh', asyncHandler(controller.refresh));
authRouter.post('/logout', authenticate, asyncHandler(controller.logout));
authRouter.get('/me', authenticate, asyncHandler(controller.me));
authRouter.post(
  '/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  asyncHandler(controller.changePassword),
);
authRouter.put(
  '/profile',
  authenticate,
  requireFreshPassword,
  validate({ body: updateProfileSchema }),
  asyncHandler(controller.updateProfile),
);
