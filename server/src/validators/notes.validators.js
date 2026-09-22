import { z } from 'zod';
import { requiredText } from './common.validators.js';

const parentId = z.coerce.number().int().positive().optional();

export const createNoteSchema = z
  .object({
    content: requiredText(4000, 'El contenido'),
    isPinned: z.boolean().optional(),
    companyId: parentId,
    contactId: parentId,
    clientId: parentId,
    leadId: parentId,
    opportunityId: parentId,
  })
  .strict();

export const updateNoteSchema = z
  .object({
    content: requiredText(4000, 'El contenido'),
    isPinned: z.boolean().optional(),
  })
  .strict();
