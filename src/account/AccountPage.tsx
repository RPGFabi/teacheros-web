import { Button, Card } from '@hoelzle/react-ui';
import { useAuth } from '@hoelzle/react-auth';
import { statusLabel } from './status';

export interface Me {
  account: { id: string; status: string; mfa_required: boolean };
  /** Effektive Rechte, fertig aufgeloest von der API (nie eine Wildcard). */
  permissions: string[];
  /** Aktive Module der Schulinstanz, immer mit `core` (Ticket #13). Fehlt bei aelteren API-Staenden: dann nur `core`. */
  modules?: string[];
  session: { used_mfa: boolean; expires_at: string };
}

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
            <dd>{statusLabel(me.account.status)}</dd>
            <dt>Anmeldung mit MFA</dt>
            <dd>{me.session.used_mfa ? 'Ja' : 'Nein'}</dd>
          </dl>
        )}
        <Button variant="secondary" onClick={() => void logout()}>Abmelden</Button>
      </Card>
    </main>
  );
}
