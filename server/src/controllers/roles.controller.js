import * as rolesService from '../services/roles.service.js';
import { ok, created, noContent } from '../utils/apiResponse.js';

export async function list(_req, res) {
  return ok(res, await rolesService.list());
}

export async function getById(req, res) {
  return ok(res, await rolesService.getById(req.validated.params.id));
}

export async function create(req, res) {
  return created(
    res,
    await rolesService.create({ data: req.validated.body, actor: req.user, ipAddress: req.ip }),
  );
}

export async function update(req, res) {
  return ok(
    res,
    await rolesService.update({
      id: req.validated.params.id,
      data: req.validated.body,
      actor: req.user,
      ipAddress: req.ip,
    }),
  );
}

export async function remove(req, res) {
  await rolesService.remove({ id: req.validated.params.id, actor: req.user, ipAddress: req.ip });
  return noContent(res);
}

export async function listPermissions(_req, res) {
  return ok(res, await rolesService.listPermissions());
}
