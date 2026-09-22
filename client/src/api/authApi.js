import { api, unwrap, setAccessToken } from './client.js';

export async function login(credentials) {
  const session = unwrap(await api.post('/auth/login', credentials));
  setAccessToken(session.accessToken);
  return session;
}

export async function logout() {
  try {
    await api.post('/auth/logout');
  } finally {
    setAccessToken(null);
  }
}

export async function me() {
  return unwrap(await api.get('/auth/me'));
}

export async function changePassword(payload) {
  await api.post('/auth/change-password', payload);
  setAccessToken(null);
}

export async function updateProfile(payload) {
  return unwrap(await api.put('/auth/profile', payload));
}
