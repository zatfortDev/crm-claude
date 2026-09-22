import * as notesService from '../services/notes.service.js';
import { ok, created, noContent } from '../utils/apiResponse.js';

export async function create(req, res) {
  return created(res, await notesService.create({ data: req.validated.body, actor: req.user }));
}

export async function update(req, res) {
  return ok(
    res,
    await notesService.update({
      id: req.validated.params.id,
      data: req.validated.body,
      actor: req.user,
    }),
  );
}

export async function remove(req, res) {
  await notesService.remove({ id: req.validated.params.id, actor: req.user });
  return noContent(res);
}
