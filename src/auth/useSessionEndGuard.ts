import { useLayoutEffect, useRef } from 'react';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { errorCode, errorReason } from '../api/errors';

/** Womit die API eine laufende Sitzung beendet: gesperrtes Konto (mit Grund) oder widerrufene Sitzung. */
export type SessionEnd = { kind: 'account_inactive'; reason: string | null } | { kind: 'session_revoked' };

export function sessionEndOf(err: unknown): SessionEnd | undefined {
  const status = (err as { response?: { status?: number } } | null | undefined)?.response?.status;
  if (status !== 401) return undefined;
  const code = errorCode(err);
  if (code === 'account_inactive') return { kind: 'account_inactive', reason: errorReason(err) ?? null };
  if (code === 'session_revoked') return { kind: 'session_revoked' };
  return undefined;
}

/**
 * Meldet bei 401 `account_inactive` oder `session_revoked` einer API-Antwort ab (egal bei welchem Aufruf).
 *
 * Der Interceptor muss VOR dem Refresh-Interceptor des AuthProviders laufen (Registrierung im Gate, also
 * im Layout-Effekt eines Kindes, der vor dem des AuthProviders laeuft, und nur einmal je Client),
 * damit der Grund noch in der Antwort steht. `_retry` markiert
 * die Anfrage fuer dessen Refresh-Logik als erledigt: ein Refresh waere nach dem Sperren sinnlos und
 * koennte die Sitzung nach dem Abmelden wiederbeleben.
 */
export function useSessionEndGuard(apiClient: AxiosInstance, onEnd: (end: SessionEnd) => void) {
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  useLayoutEffect(() => {
    const id = apiClient.interceptors.response.use(
      (response) => response,
      (error: unknown) => {
        const end = sessionEndOf(error);
        if (end) {
          const config = (error as { config?: InternalAxiosRequestConfig & { _retry?: boolean } }).config;
          if (config) config._retry = true;
          onEndRef.current(end);
        }
        return Promise.reject(error);
      }
    );
    return () => apiClient.interceptors.response.eject(id);
  }, [apiClient]);
}
