import * as usersService from '../services/users.service.js';
import { ok, created, noContent, paginated } from '../utils/apiResponse.js';

export async function list(req, res) {
  const query = req.validated.query;
  const { items, total } = await usersService.list(query);
  return paginated(res, { items, total, page: query.page, pageSize: query.pageSize });
}

export async function options(_req, res) {
  return ok(res, await usersService.options());
}

export async function getById(req, res) {
  return ok(res, await usersService.getById(req.validated.params.id));
}

export async function create(req, res) {
  const user = await usersService.create({
    data: req.validated.body,
    actor: req.user,
    ipAddress: req.ip,
  });
  return created(res, user);
}

export async function update(req, res) {
  const user = await usersService.update({
    id: req.validated.params.id,
    data: req.validated.body,
    actor: req.user,
    ipAddress: req.ip,
  });
  return ok(res, user);
}

export async function setStatus(req, res) {
  const user = await usersService.setStatus({
    id: req.validated.params.id,
    isActive: req.validated.body.isActive,
    actor: req.user,
    ipAddress: req.ip,
  });
  return ok(res, user);
}

export async function setRole(req, res) {
  const user = await usersService.setRole({
    id: req.validated.params.id,
    roleId: req.validated.body.roleId,
    actor: req.user,
    ipAddress: req.ip,
  });
  return ok(res, user);
}

export async function resetPassword(req, res) {
  await usersService.resetPassword({
    id: req.validated.params.id,
    temporaryPassword: req.validated.body.temporaryPassword,
    actor: req.user,
    ipAddress: req.ip,
  });
  return noContent(res);
}
