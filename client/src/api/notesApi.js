import { api, unwrap } from './client.js';

export async function createNote(payload) {
  return unwrap(await api.post('/notes', payload));
}

export async function updateNote(id, payload) {
  return unwrap(await api.put(`/notes/${id}`, payload));
}

export async function deleteNote(id) {
  await api.delete(`/notes/${id}`);
}
