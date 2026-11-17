import axios from 'axios';

export function createApiClient(env: { VITE_API_BASE_URL?: string } = import.meta.env) {
  return axios.create({ baseURL: env.VITE_API_BASE_URL || 'http://localhost:8000' });
}

export const apiClient = createApiClient();
