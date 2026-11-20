import axios from 'axios';
import { appEnv } from '../config/env';

export function createApiClient(baseURL: string = appEnv.apiBaseUrl) {
  return axios.create({ baseURL, timeout: 10000 });
}

/** Auth-Instanz der eigenen Schule; withCredentials fuer das HttpOnly-Refresh-Cookie. */
export function createAuthClient(baseURL: string = appEnv.authBaseUrl) {
  return axios.create({ baseURL, timeout: 10000, withCredentials: true });
}

export const apiClient = createApiClient();
export const authClient = createAuthClient();
