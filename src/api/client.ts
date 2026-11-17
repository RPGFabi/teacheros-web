import axios from 'axios';

type Env = { VITE_API_BASE_URL?: string; VITE_AUTH_BASE_URL?: string };

export function createApiClient(env: Env = import.meta.env) {
  return axios.create({ baseURL: env.VITE_API_BASE_URL || 'http://localhost:8000' });
}

/** Auth-Instanz der eigenen Schule; withCredentials fuer das HttpOnly-Refresh-Cookie. */
export function createAuthClient(env: Env = import.meta.env) {
  return axios.create({ baseURL: env.VITE_AUTH_BASE_URL || 'http://127.0.0.1:8100', withCredentials: true });
}

export const apiClient = createApiClient();
export const authClient = createAuthClient();
