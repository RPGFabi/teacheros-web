import { useState } from 'react';
import { Button, Card, ConfirmDialog } from '@hoelzle/react-ui';
import { useAuth } from '@hoelzle/react-auth';
import type { AxiosInstance } from 'axios';
import { errorCode } from '../api/errors';
import { statusLabel } from './status';

export interface Me {
  account: { id: string; status: string; mfa_required: boolean };
  /** Effektive Rechte, fertig aufgeloest von der API (nie eine Wildcard). */
  permissions: string[];
  /** Aktive Module der Schulinstanz, immer mit `core` (Ticket #13). Fehlt bei aelteren API-Staenden: dann nur `core`. */
  modules?: string[];
  /** `mfa_enrollment_required`: MFA-Pflicht, aber ohne zweiten Faktor angemeldet (ADR 0002 B3); fachliche Routen sind gesperrt. */
  session: { used_mfa: boolean; expires_at: string; mfa_enrollment_required?: boolean };
}

/** Hinweis auf der Anmeldeseite nach dem eigenen Sitzungswiderruf (Ticket #50). */
const SESSIONS_REVOKED_NOTICE = 'Alle Sitzungen wurden beendet.';
const REVOCATION_FAILED = 'Die Sitzungen konnten nicht beendet werden. Bitte versuchen Sie es erneut.';
/**
 * Alle Versuche beim Anmeldedienst sind gescheitert (502 `auth_unavailable`): die Sitzungen sind hier gesperrt, der Widerruf bleibt offen.
 * Das Konto ist damit ohnehin abgelehnt; das Web meldet ab und zeigt den Hinweis auf der Anmeldeseite.
 */
const REVOCATION_UNCONFIRMED =
  'Der Anmeldedienst ist gerade nicht erreichbar. Ihre Sitzungen sind gesperrt, das ist dem Anmeldedienst aber noch nicht gemeldet. Bitte melden Sie sich später erneut an oder wenden Sie sich an Ihre Schule.';

/**
 * „Mein Konto“. Alle Sitzungen beenden (Ticket #50): „Alle Sitzungen beenden …“ mit Bestaetigungsdialog, ohne besonderes Recht.
 * Die API beendet auch die aktuelle Sitzung; bei Erfolg meldet das Web ueber `onSessionsRevoked` ab (der Aufrufer zeigt den
 * Hinweis auf der Anmeldeseite). Ist der Anmeldedienst nicht erreichbar (502 `auth_unavailable`), sind die Sitzungen trotzdem gesperrt:
 * auch dann meldet das Web ab und der Hinweis dazu erscheint auf der Anmeldeseite. Sonstige Fehler bleiben auf der Seite stehen.
 */
export default function AccountPage({
  me,
  error,
  apiClient,
  onSessionsRevoked = () => undefined
}: {
  me: Me | null;
  error: string | null;
  apiClient: AxiosInstance;
  /** Das Konto ist abzumelden; `notice` ist der Hinweis fuer die Anmeldeseite. */
  onSessionsRevoked?: (notice: string) => void;
}) {
  const { currentMail, logout } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revocationError, setRevocationError] = useState<string | null>(null);

  async function revokeSessions() {
    setConfirming(false);
    setBusy(true);
    setRevocationError(null);
    try {
      await apiClient.post('/api/me/revoke-sessions');
      onSessionsRevoked(SESSIONS_REVOKED_NOTICE);
    } catch (err) {
      if (errorCode(err) === 'auth_unavailable') {
        onSessionsRevoked(REVOCATION_UNCONFIRMED);
        return;
      }
      setRevocationError(REVOCATION_FAILED);
      setBusy(false);
    }
  }

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
      <Card>
        <section aria-label="Sitzungen">
          <h2>Sitzungen</h2>
          <p>Beendet alle Ihre Sitzungen auf allen Geräten, auch diese, etwa nach einem Geräteverlust. Sie melden sich danach neu an.</p>
          {revocationError && <p role="alert">{revocationError}</p>}
          <Button variant="secondary" disabled={busy} onClick={() => setConfirming(true)}>Alle Sitzungen beenden …</Button>
        </section>
      </Card>
      <ConfirmDialog
        open={confirming}
        title="Alle Sitzungen beenden?"
        description="Alle Ihre Sitzungen enden sofort, auch auf diesem Gerät und auf anderen Geräten. Sie werden abgemeldet und müssen sich neu anmelden."
        confirmText="Alle Sitzungen beenden"
        variant="danger"
        onConfirm={() => void revokeSessions()}
        onCancel={() => setConfirming(false)}
      />
    </main>
  );
}
