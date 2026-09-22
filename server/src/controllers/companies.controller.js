import * as companiesService from '../services/companies.service.js';
import * as contactsService from '../services/contacts.service.js';
import * as notesService from '../services/notes.service.js';
import { getTimeline } from '../services/timeline.service.js';
import { ok, created, paginated } from '../utils/apiResponse.js';
import { can } from '../middleware/authorize.js';

/** Ver archivados requiere el permiso de archivar/restaurar. */
function includeDeleted(req) {
  return Boolean(req.validated.query?.includeDeleted && can(req.user, 'companies:delete'));
}

export async function list(req, res) {
  const query = { ...req.validated.query, includeDeleted: includeDeleted(req) };
  const { items, total } = await companiesService.list(query);
  return paginated(res, { items, total, page: query.page, pageSize: query.pageSize });
}

export async function getById(req, res) {
  const company = await companiesService.getById(req.validated.params.id, {
    includeDeleted: can(req.user, 'companies:delete'),
  });
  return ok(res, company);
}

export async function create(req, res) {
  return created(
    res,
    await companiesService.create({ data: req.validated.body, actor: req.user, ipAddress: req.ip }),
  );
}

export async function update(req, res) {
  return ok(
    res,
    await companiesService.update({
      id: req.validated.params.id,
      data: req.validated.body,
      actor: req.user,
      ipAddress: req.ip,
    }),
  );
}

export async function archive(req, res) {
  return ok(
    res,
    await companiesService.archive({
      id: req.validated.params.id,
      actor: req.user,
      ipAddress: req.ip,
    }),
  );
}

export async function restore(req, res) {
  return ok(
    res,
    await companiesService.restore({
      id: req.validated.params.id,
      actor: req.user,
      ipAddress: req.ip,
    }),
  );
}

export async function listContacts(req, res) {
  const { id } = req.validated.params;
  await companiesService.findCompanyOrFail(id, { includeDeleted: true });
  const query = { ...req.validated.query, companyId: id };
  const { items, total } = await contactsService.list(query);
  return paginated(res, { items, total, page: query.page, pageSize: query.pageSize });
}

export async function listNotes(req, res) {
  const { id } = req.validated.params;
  await companiesService.findCompanyOrFail(id, { includeDeleted: true });
  return ok(res, await notesService.listByParent('companyId', id));
}

export async function timeline(req, res) {
  const { id } = req.validated.params;
  await companiesService.findCompanyOrFail(id, { includeDeleted: true });
  const { page, pageSize } = req.validated.query;
  const { items, total } = await getTimeline({
    entityType: 'Company',
    entityId: id,
    noteField: 'companyId',
    page,
    pageSize,
  });
  return paginated(res, { items, total, page, pageSize });
}
