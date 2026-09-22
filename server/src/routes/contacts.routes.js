import { Router } from 'express';
import * as controller from '../controllers/contacts.controller.js';
import { validate } from '../middleware/validate.js';
import { authorize } from '../middleware/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { idParamSchema } from '../validators/common.validators.js';
import { listContactsQuerySchema, contactBodySchema } from '../validators/contacts.validators.js';
import { timelineQuerySchema } from '../validators/timeline.validators.js';

export const contactsRouter = Router();

contactsRouter.get(
  '/',
  authorize('contacts:read'),
  validate({ query: listContactsQuerySchema }),
  asyncHandler(controller.list),
);
contactsRouter.post(
  '/',
  authorize('contacts:create'),
  validate({ body: contactBodySchema }),
  asyncHandler(controller.create),
);
contactsRouter.get(
  '/:id',
  authorize('contacts:read'),
  validate({ params: idParamSchema }),
  asyncHandler(controller.getById),
);
contactsRouter.put(
  '/:id',
  authorize('contacts:update'),
  validate({ params: idParamSchema, body: contactBodySchema }),
  asyncHandler(controller.update),
);
contactsRouter.delete(
  '/:id',
  authorize('contacts:delete'),
  validate({ params: idParamSchema }),
  asyncHandler(controller.archive),
);
contactsRouter.post(
  '/:id/restore',
  authorize('contacts:delete'),
  validate({ params: idParamSchema }),
  asyncHandler(controller.restore),
);
contactsRouter.get(
  '/:id/notes',
  authorize('contacts:read'),
  validate({ params: idParamSchema }),
  asyncHandler(controller.listNotes),
);
contactsRouter.get(
  '/:id/timeline',
  authorize('contacts:read'),
  validate({ params: idParamSchema, query: timelineQuerySchema }),
  asyncHandler(controller.timeline),
);
