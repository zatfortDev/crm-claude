import { Router } from 'express';
import * as controller from '../controllers/notes.controller.js';
import { validate } from '../middleware/validate.js';
import { authorize } from '../middleware/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { idParamSchema } from '../validators/common.validators.js';
import { createNoteSchema, updateNoteSchema } from '../validators/notes.validators.js';

export const notesRouter = Router();

// El listado de notas se obtiene desde la entidad padre (GET /companies/:id/notes, …).
notesRouter.post(
  '/',
  authorize('notes:create'),
  validate({ body: createNoteSchema }),
  asyncHandler(controller.create),
);
notesRouter.put(
  '/:id',
  authorize('notes:update', 'notes:manage'),
  validate({ params: idParamSchema, body: updateNoteSchema }),
  asyncHandler(controller.update),
);
notesRouter.delete(
  '/:id',
  authorize('notes:delete', 'notes:manage'),
  validate({ params: idParamSchema }),
  asyncHandler(controller.remove),
);
