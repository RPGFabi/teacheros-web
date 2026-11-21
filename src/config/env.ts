/*
 * Zentrale Vite-ENV-Konfiguration (gleiche Konvention wie die anderen Frontends des Deploy-Workflows).
 * Alle Variablen beginnen mit VITE_APP_ und sind Pflicht: Fehlt eine, bricht die App sofort ab,
 * statt still gegen localhost zu bauen.
 */

type RawEnv = {
  VITE_APP_NAME?: string;
  VITE_APP_ENV?: string;
  VITE_APP_FRONTEND_BASE_URL?: string;
  VITE_APP_API_BASE_URL?: string;
  VITE_APP_AUTH_BASE_URL?: string;
};

export type AppEnv = {
  readonly appName: string;
  readonly env: string;
  readonly frontendBaseUrl: string;
  readonly apiBaseUrl: string;
  readonly authBaseUrl: string;
};

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

export function readAppEnv(raw: RawEnv): AppEnv {
  const required = (key: keyof RawEnv): string => {
    const value = raw[key]?.trim();
    if (!value) throw new Error(`Missing required frontend env variable: ${key}`);
    return value;
  };

  return {
    appName: required('VITE_APP_NAME'),
    env: required('VITE_APP_ENV'),
    frontendBaseUrl: normalizeBaseUrl(required('VITE_APP_FRONTEND_BASE_URL')),
    apiBaseUrl: normalizeBaseUrl(required('VITE_APP_API_BASE_URL')),
    authBaseUrl: normalizeBaseUrl(required('VITE_APP_AUTH_BASE_URL'))
  };
}

// Statisch aus import.meta.env lesen: Vite ersetzt nur direkte Zugriffe zuverlaessig im Build.
export const appEnv = readAppEnv({
  VITE_APP_NAME: import.meta.env.VITE_APP_NAME,
  VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
  VITE_APP_FRONTEND_BASE_URL: import.meta.env.VITE_APP_FRONTEND_BASE_URL,
  VITE_APP_API_BASE_URL: import.meta.env.VITE_APP_API_BASE_URL,
  VITE_APP_AUTH_BASE_URL: import.meta.env.VITE_APP_AUTH_BASE_URL
});
