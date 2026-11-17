import { useEffect, useState } from 'react';
import { Button, Card } from '@hoelzle/react-ui';
import { useAuth } from '@hoelzle/react-auth';
import type { AxiosInstance } from 'axios';

interface Me {
  account: { id: string; status: string; mfa_required: boolean };
  session: { used_mfa: boolean; expires_at: string };
}

const STATUS_LABEL: Record<string, string> = { active: 'Aktiv', invited: 'Eingeladen', inactive: 'Inaktiv' };

export default function AccountPage({ apiClient }: { apiClient: AxiosInstance }) {
  const { currentMail, logout } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<Me>('/api/me')
      .then((response) => !cancelled && setMe(response.data))
      .catch((err) => {
        if (cancelled) return;
        const code = err?.response?.data?.code;
        setError(code === 'account_inactive' ? 'Ihr Konto ist nicht aktiv. Bitte wenden Sie sich an die Schuladministration.' : 'Die Kontodaten konnten nicht geladen werden.');
      });
    return () => {
      cancelled = true;
    };
  }, [apiClient]);

  return (
    <main className="content">
      <h1>Mein Konto</h1>
      <Card>
        {error && <p role="alert">{error}</p>}
        {!error && !me && <p>Kontodaten werden geladen …</p>}
        {me && (
          <dl>
            <dt>E-Mail</dt>
            <dd>{currentMail}</dd>
            <dt>Konto-ID</dt>
            <dd>{me.account.id}</dd>
            <dt>Status</dt>
            <dd>{STATUS_LABEL[me.account.status] ?? me.account.status}</dd>
            <dt>Anmeldung mit MFA</dt>
            <dd>{me.session.used_mfa ? 'Ja' : 'Nein'}</dd>
          </dl>
        )}
        <Button variant="secondary" onClick={() => void logout()}>Abmelden</Button>
      </Card>
    </main>
  );
}
