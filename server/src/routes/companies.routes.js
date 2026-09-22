import { Router } from 'express';
import * as controller from '../controllers/companies.controller.js';
import { validate } from '../middleware/validate.js';
import { authorize } from '../middleware/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { idParamSchema } from '../validators/common.validators.js';
import { listCompaniesQuerySchema, companyBodySchema } from '../validators/companies.validators.js';
import { listContactsQuerySchema } from '../validators/contacts.validators.js';
import { timelineQuerySchema } from '../validators/timeline.validators.js';

export const companiesRouter = Router();

companiesRouter.get(
  '/',
  authorize('companies:read'),
  validate({ query: listCompaniesQuerySchema }),
  asyncHandler(controller.list),
);
companiesRouter.post(
  '/',
  authorize('companies:create'),
  validate({ body: companyBodySchema }),
  asyncHandler(controller.create),
);
companiesRouter.get(
  '/:id',
  authorize('companies:read'),
  validate({ params: idParamSchema }),
  asyncHandler(controller.getById),
);
companiesRouter.put(
  '/:id',
  authorize('companies:update'),
  validate({ params: idParamSchema, body: companyBodySchema }),
  asyncHandler(controller.update),
);
companiesRouter.delete(
  '/:id',
  authorize('companies:delete'),
  validate({ params: idParamSchema }),
  asyncHandler(controller.archive),
);
companiesRouter.post(
  '/:id/restore',
  authorize('companies:delete'),
  validate({ params: idParamSchema }),
  asyncHandler(controller.restore),
);
companiesRouter.get(
  '/:id/contacts',
  authorize('contacts:read'),
  validate({ params: idParamSchema, query: listContactsQuerySchema }),
  asyncHandler(controller.listContacts),
);
companiesRouter.get(
  '/:id/notes',
  authorize('companies:read'),
  validate({ params: idParamSchema }),
  asyncHandler(controller.listNotes),
);
companiesRouter.get(
  '/:id/timeline',
  authorize('companies:read'),
  validate({ params: idParamSchema, query: timelineQuerySchema }),
  asyncHandler(controller.timeline),
);
