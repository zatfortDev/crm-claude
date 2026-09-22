import { api, unwrap } from './client.js';

export async function listUsers(params) {
  const response = await api.get('/users', { params });
  return { items: response.data.data, meta: response.data.meta };
}

export async function getUser(id) {
  return unwrap(await api.get(`/users/${id}`));
}

export async function createUser(payload) {
  return unwrap(await api.post('/users', payload));
}

export async function updateUser(id, payload) {
  return unwrap(await api.put(`/users/${id}`, payload));
}

export async function setUserStatus(id, isActive) {
  return unwrap(await api.patch(`/users/${id}/status`, { isActive }));
}

export async function setUserRole(id, roleId) {
  return unwrap(await api.patch(`/users/${id}/role`, { roleId }));
}

export async function resetUserPassword(id, temporaryPassword) {
  await api.post(`/users/${id}/reset-password`, { temporaryPassword });
}

export async function listRoles() {
  return unwrap(await api.get('/roles'));
}
