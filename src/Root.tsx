import { useEffect, useMemo, useState } from 'react';
import { AuthProvider, useAuth } from '@hoelzle/react-auth';
import type { AxiosInstance } from 'axios';
import App from './App';
import LoginPage from './auth/LoginPage';
import { lockNotice } from './auth/lockNotice';
import { useSessionEndGuard } from './auth/useSessionEndGuard';
import InvitationPage from './invitation/InvitationPage';
import { apiClient as defaultApiClient, authClient as defaultAuthClient } from './api/clients';

function Gate({ apiClient, authClient, notice }: { apiClient: AxiosInstance; authClient: AxiosInstance; notice?: string }) {
  const { isAuthReady, isAuthenticated, logout } = useAuth();
  // Hinweis, warum die laufende Sitzung beendet wurde (nur bei Sperre; bei widerrufener Sitzung keiner).
  const [sessionNotice, setSessionNotice] = useState<string | undefined>();
  useSessionEndGuard(apiClient, (end) => {
    setSessionNotice(end.kind === 'account_inactive' ? lockNotice(end.reason) : undefined);
    void logout();
  });
  // Wer sich wieder angemeldet hat, soll den alten Hinweis nicht bei der naechsten Abmeldung sehen.
  useEffect(() => {
    if (isAuthenticated) setSessionNotice(undefined);
  }, [isAuthenticated]);

  if (!isAuthReady) return <p className="content">Wird geladen …</p>;
  if (!isAuthenticated) return <LoginPage notice={sessionNotice ?? notice} />;
  return (
    <App
      apiClient={apiClient}
      authClient={authClient}
      initialPortal="account"
      onReauthenticate={(text) => {
        // Nach der MFA-Einrichtung (Ticket #15): neu anmelden, damit das Token den zweiten Faktor traegt.
        setSessionNotice(text);
        void logout();
      }}
    />
  );
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
      <Gate apiClient={apiClient} authClient={authClient} notice={accepted ? 'Ihr Passwort ist gesetzt. Bitte melden Sie sich jetzt an.' : undefined} />
    </AuthProvider>
  );
}

function readInvitation(location: Pick<Location, 'pathname' | 'search'>): { token?: string; code?: string } | null {
  if (location.pathname.replace(/\/+$/, '') !== '/einladung') return null;
  const params = new URLSearchParams(location.search);
  return { token: params.get('token') ?? undefined, code: params.get('code') ?? undefined };
}
