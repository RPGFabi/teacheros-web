import { useMemo, useState } from 'react';
import { AuthProvider, useAuth } from '@hoelzle/react-auth';
import type { AxiosInstance } from 'axios';
import App from './App';
import LoginPage from './auth/LoginPage';
import InvitationPage from './invitation/InvitationPage';
import { apiClient as defaultApiClient, authClient as defaultAuthClient } from './api/client';

function Gate({ apiClient, notice }: { apiClient: AxiosInstance; notice?: string }) {
  const { isAuthReady, isAuthenticated } = useAuth();
  if (!isAuthReady) return <p className="content">Wird geladen …</p>;
  if (!isAuthenticated) return <LoginPage notice={notice} />;
  return <App apiClient={apiClient} initialPortal="account" />;
}

export default function Root({
  authClient = defaultAuthClient,
  apiClient = defaultApiClient
}: {
  authClient?: AxiosInstance;
  apiClient?: AxiosInstance;
}) {
  // Die Einladungsseite ist oeffentlich: /einladung?token=... (Mail) oder ?code=... (QR-Code der Einladungskarte).
  const [invitation, setInvitation] = useState(() => readInvitation(window.location));
  const [accepted, setAccepted] = useState(false);
  // Der AuthProvider verlangt eine stabile Referenz fuer die Clients, die das Token erhalten.
  const clients = useMemo(() => [apiClient, authClient] as const, [apiClient, authClient]);
  if (invitation) {
    return (
      <InvitationPage
        authClient={authClient}
        token={invitation.token}
        code={invitation.code}
        onAccepted={() => {
          window.history.replaceState(null, '', '/');
          setInvitation(null);
          setAccepted(true);
        }}
      />
    );
  }

  return (
    <AuthProvider authClient={authClient} apiClients={clients} sessionHintKey="teacheros_has_session">
      <Gate apiClient={apiClient} notice={accepted ? 'Ihr Passwort ist gesetzt. Bitte melden Sie sich jetzt an.' : undefined} />
    </AuthProvider>
  );
}

function readInvitation(location: Pick<Location, 'pathname' | 'search'>): { token?: string; code?: string } | null {
  if (location.pathname.replace(/\/+$/, '') !== '/einladung') return null;
  const params = new URLSearchParams(location.search);
  return { token: params.get('token') ?? undefined, code: params.get('code') ?? undefined };
}
