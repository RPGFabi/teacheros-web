import { describe, expect, it } from 'vitest';
import { createApiClient } from './client';

describe('API-Client', () => {
  it('nutzt die Basis-URL aus der Umgebung', () => {
    expect(createApiClient({ VITE_API_BASE_URL: 'https://api.example.test' }).defaults.baseURL).toBe('https://api.example.test');
  });
  it('faellt auf localhost zurueck', () => {
    expect(createApiClient({}).defaults.baseURL).toBe('http://localhost:8000');
  });
});
