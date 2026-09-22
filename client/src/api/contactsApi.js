import { api, unwrap } from './client.js';

export async function listContacts(params) {
  const response = await api.get('/contacts', { params });
  return { items: response.data.data, meta: response.data.meta };
}

export async function getContact(id) {
  return unwrap(await api.get(`/contacts/${id}`));
}

export async function createContact(payload) {
  return unwrap(await api.post('/contacts', payload));
}

export async function updateContact(id, payload) {
  return unwrap(await api.put(`/contacts/${id}`, payload));
}

export async function archiveContact(id) {
  return unwrap(await api.delete(`/contacts/${id}`));
}

export async function restoreContact(id) {
  return unwrap(await api.post(`/contacts/${id}/restore`));
}

export async function listContactNotes(id) {
  return unwrap(await api.get(`/contacts/${id}/notes`));
}

export async function getContactTimeline(id, params) {
  const response = await api.get(`/contacts/${id}/timeline`, { params });
  return { items: response.data.data, meta: response.data.meta };
}
