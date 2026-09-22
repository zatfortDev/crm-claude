// Instancia de Axios compartida. Los interceptores de autenticación (token en memoria,
// refresh silencioso ante 401) se añaden en el módulo de auth.
import axios from 'axios';
import { API_URL } from '../lib/constants.js';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

/** Extrae `data` del envoltorio de la API o lanza un error normalizado. */
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
