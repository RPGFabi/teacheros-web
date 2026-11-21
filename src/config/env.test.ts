import { describe, expect, it } from 'vitest';
import { readAppEnv } from './env';

const FULL = {
  VITE_APP_NAME: 'TeacherOS',
  VITE_APP_ENV: 'dev',
  VITE_APP_FRONTEND_BASE_URL: 'https://schule.example.test/',
  VITE_APP_API_BASE_URL: 'https://api.example.test//',
  VITE_APP_AUTH_BASE_URL: 'https://auth.example.test'
};

describe('Frontend-ENV', () => {
  it('liest alle Werte und entfernt abschliessende Slashes', () => {
    expect(readAppEnv(FULL)).toEqual({
      appName: 'TeacherOS',
      env: 'dev',
      frontendBaseUrl: 'https://schule.example.test',
      apiBaseUrl: 'https://api.example.test',
      authBaseUrl: 'https://auth.example.test'
    });
  });

  it.each(Object.keys(FULL))('bricht ab, wenn %s fehlt', (key) => {
    expect(() => readAppEnv({ ...FULL, [key]: undefined })).toThrow(`Missing required frontend env variable: ${key}`);
  });

  it('wertet einen leeren Wert als fehlend', () => {
    expect(() => readAppEnv({ ...FULL, VITE_APP_API_BASE_URL: '  ' })).toThrow('VITE_APP_API_BASE_URL');
  });
});
