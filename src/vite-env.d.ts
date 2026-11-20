/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
  readonly VITE_APP_ENV?: string;
  readonly VITE_APP_FRONTEND_BASE_URL?: string;
  readonly VITE_APP_API_BASE_URL?: string;
  readonly VITE_APP_AUTH_BASE_URL?: string;
}
