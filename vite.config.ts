/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0'
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // src/config/env.ts verlangt alle VITE_APP_*-Werte; Tests laufen ohne .env.
    env: {
      VITE_APP_NAME: 'TeacherOS Test',
      VITE_APP_ENV: 'test',
      VITE_APP_FRONTEND_BASE_URL: 'http://localhost:5173',
      VITE_APP_API_BASE_URL: 'http://localhost:8000',
      VITE_APP_AUTH_BASE_URL: 'http://127.0.0.1:8100'
    },
    css: true,
    server: { deps: { inline: [/@hoelzle\//] } }
  }
});
