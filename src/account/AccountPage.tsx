import { Button, Card } from '@hoelzle/react-ui';
import { useAuth } from '@hoelzle/react-auth';

export interface Me {
  account: { id: string; status: string; mfa_required: boolean };
  /** Effektive Rechte, fertig aufgeloest von der API (nie eine Wildcard). */
  permissions: string[];
  session: { used_mfa: boolean; expires_at: string };
}

const STATUS_LABEL: Record<string, string> = { active: 'Aktiv', invited: 'Eingeladen', inactive: 'Inaktiv' };

export default function AccountPage({ me, error }: { me: Me | null; error: string | null }) {
  const { currentMail, logout } = useAuth();

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
