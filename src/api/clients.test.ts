import { describe, expect, it } from 'vitest';
import { createApiClient, createAuthClient } from './clients';

describe('API-Clients', () => {
  it('nutzt die API-Basis-URL', () => {
    expect(createApiClient('https://api.example.test').defaults.baseURL).toBe('https://api.example.test');
  });
  it('schickt beim Auth-Client Cookies mit', () => {
    const client = createAuthClient('https://auth.example.test');
    expect(client.defaults.baseURL).toBe('https://auth.example.test');
    expect(client.defaults.withCredentials).toBe(true);
  });
});
