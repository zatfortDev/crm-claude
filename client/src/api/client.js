// Instancia de Axios compartida.
// El access token vive solo en memoria (nunca en localStorage: docs/security.md T-02).
// Ante un 401 se intenta un refresh silencioso con la cookie httpOnly y se reintenta la petición.
import axios from 'axios';
import { API_URL } from '../lib/constants.js';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

let accessToken = null;
let onSessionLost = null;
let refreshPromise = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

/** Callback invocado cuando la sesión deja de ser válida (el AuthContext lo usa para desloguear). */
export function setSessionLostHandler(handler) {
  onSessionLost = handler;
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

/** Pide un nuevo access token; varias peticiones en paralelo comparten la misma promesa. */
export function refreshSession() {
  refreshPromise ??= api
    .post('/auth/refresh')
    .then((response) => {
      const session = response.data.data;
      setAccessToken(session.accessToken);
      return session;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const isAuthEndpoint = original?.url?.startsWith('/auth/');

    if (status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      try {
        await refreshSession();
        return api(original);
      } catch {
        setAccessToken(null);
        onSessionLost?.();
      }
    }
    return Promise.reject(error);
  },
);

/** Extrae `data` del envoltorio de la API. */
export function unwrap(response) {
  return response.data?.data;
}

/** Normaliza un error de Axios al formato { status, code, message, details }. */
export function toApiError(error) {
  const status = error.response?.status ?? 0;
  const payload = error.response?.data?.error;
  return {
    status,
    code: payload?.code ?? (status === 0 ? 'NETWORK_ERROR' : 'UNKNOWN'),
    message:
      payload?.message ??
      (status === 0 ? 'No se pudo conectar con el servidor' : 'Ocurrió un error inesperado'),
    details: payload?.details,
  };
}

/** Aplica los errores por campo devueltos por el backend a un formulario de react-hook-form. */
export function applyServerErrors(error, setError) {
  const apiError = toApiError(error);
  if (Array.isArray(apiError.details)) {
    for (const detail of apiError.details) {
      if (detail.field) setError(detail.field, { type: 'server', message: detail.message });
    }
  }
  return apiError;
}
