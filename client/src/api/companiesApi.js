import { api, unwrap } from './client.js';

export async function listCompanies(params) {
  const response = await api.get('/companies', { params });
  return { items: response.data.data, meta: response.data.meta };
}

export async function getCompany(id) {
  return unwrap(await api.get(`/companies/${id}`));
}

export async function createCompany(payload) {
  return unwrap(await api.post('/companies', payload));
}

export async function updateCompany(id, payload) {
  return unwrap(await api.put(`/companies/${id}`, payload));
}

export async function archiveCompany(id) {
  return unwrap(await api.delete(`/companies/${id}`));
}

export async function restoreCompany(id) {
  return unwrap(await api.post(`/companies/${id}/restore`));
}

export async function listCompanyContacts(id, params) {
  const response = await api.get(`/companies/${id}/contacts`, { params });
  return { items: response.data.data, meta: response.data.meta };
}

export async function listCompanyNotes(id) {
  return unwrap(await api.get(`/companies/${id}/notes`));
}

export async function getCompanyTimeline(id, params) {
  const response = await api.get(`/companies/${id}/timeline`, { params });
  return { items: response.data.data, meta: response.data.meta };
}
