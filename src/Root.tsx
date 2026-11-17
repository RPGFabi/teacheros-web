import { useMemo } from 'react';
import { AuthProvider, useAuth } from '@hoelzle/react-auth';
import type { AxiosInstance } from 'axios';
import App from './App';
import LoginPage from './auth/LoginPage';
import { apiClient as defaultApiClient, authClient as defaultAuthClient } from './api/client';

function Gate({ apiClient }: { apiClient: AxiosInstance }) {
  const { isAuthReady, isAuthenticated } = useAuth();
  if (!isAuthReady) return <p className="content">Wird geladen …</p>;
  if (!isAuthenticated) return <LoginPage />;
  return <App apiClient={apiClient} initialPortal="account" />;
}

export default function Root({
  authClient = defaultAuthClient,
  apiClient = defaultApiClient
}: {
  authClient?: AxiosInstance;
  apiClient?: AxiosInstance;
}) {
  // Der AuthProvider verlangt eine stabile Referenz fuer die Clients, die das Token erhalten.
  const clients = useMemo(() => [apiClient, authClient] as const, [apiClient, authClient]);
  return (
    <AuthProvider authClient={authClient} apiClients={clients} sessionHintKey="teacheros_has_session">
      <Gate apiClient={apiClient} />
    </AuthProvider>
  );
}
