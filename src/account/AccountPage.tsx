import { Button, Card } from '@hoelzle/react-ui';
import { useAuth } from '@hoelzle/react-auth';
import { statusLabel } from './status';

export interface Me {
  account: { id: string; status: string; mfa_required: boolean };
  /** Effektive Rechte, fertig aufgeloest von der API (nie eine Wildcard). */
  permissions: string[];
  /** `mfa_enrollment_required`: MFA-Pflicht, aber ohne zweiten Faktor angemeldet (ADR 0002 B3); fachliche Routen sind gesperrt. */
  session: { used_mfa: boolean; expires_at: string; mfa_enrollment_required?: boolean };
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
