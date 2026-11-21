import { useState, type FormEvent } from 'react';
import { Button, Card, FormField, TextInput } from '@hoelzle/react-ui';
import { QRCodeSVG } from 'qrcode.react';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import { errorCode } from '../api/errors';

/** Antwort von POST /mfa/setup des Anmeldedienstes. */
interface Setup {
  secret_readable: string;
  provisioning_uri: string;
  setup_token: string;
}

type Step = { kind: 'intro' } | { kind: 'scan'; setup: Setup } | { kind: 'codes'; codes: string[] } | { kind: 'already' };

export const ENROLLED_NOTICE = 'Die Authenticator-App ist eingerichtet. Bitte melden Sie sich jetzt erneut an und bestätigen Sie die Anmeldung mit dem Code aus der App.';
export const ALREADY_ENROLLED_NOTICE = 'Bitte melden Sie sich erneut an und bestätigen Sie die Anmeldung mit dem Code aus Ihrer Authenticator-App.';

/**
 * Einrichtung des zweiten Faktors (TOTP) fuer Konten mit MFA-Pflicht (Ticket #15, ADR 0002 B3). Die API sperrt fachliche
 * Routen mit 403 `mfa_enrollment_required`, bis ein Token mit MFA vorliegt. Die Einrichtung laeuft beim Anmeldedienst
 * (`/mfa/setup`, `/mfa/setup/confirm`); danach widerruft er die Sitzung, die Person meldet sich neu an ({@link onReauthenticate}).
 */
export default function MfaEnrollmentPage({ authClient, onReauthenticate }: { authClient: AxiosInstance; onReauthenticate: (notice: string) => void }) {
  const [step, setStep] = useState<Step>({ kind: 'intro' });
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const { data } = await authClient.post<Setup>('/mfa/setup');
      setCode('');
      setStep({ kind: 'scan', setup: data });
    } catch (err) {
      if (errorCode(err) === 'mfa_already_enabled') setStep({ kind: 'already' });
      else setError('Die Einrichtung konnte nicht gestartet werden. Bitte versuchen Sie es erneut.');
    } finally {
      setBusy(false);
    }
  }

  async function confirm(event: FormEvent, setup: Setup) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // `_retry` haelt den Refresh-Interceptor von react-auth fern: ein 401 heisst hier "Code falsch" bzw. "Einrichtung
      // abgelaufen", nicht "Token abgelaufen", und der Code darf nicht ein zweites Mal gesendet werden. Die Bestaetigung
      // braucht kein Access-Token, sie traegt das setup_token.
      const { data } = await authClient.post<{ recovery_codes?: string[] }>(
        '/mfa/setup/confirm',
        { setup_token: setup.setup_token, code: code.trim() },
        { _retry: true } as AxiosRequestConfig
      );
      setStep({ kind: 'codes', codes: data.recovery_codes ?? [] });
    } catch (err) {
      if (errorCode(err) === 'invalid_mfa_code') {
        setError('Der Code ist ungültig. Bitte geben Sie den aktuellen Code aus der App ein.');
      } else if (errorCode(err) === 'invalid_setup_token' || errorCode(err) === 'invalid_token') {
        setStep({ kind: 'intro' });
        setError('Die Einrichtung ist abgelaufen. Bitte starten Sie sie erneut.');
      } else {
        setError('Die Einrichtung konnte nicht abgeschlossen werden. Bitte versuchen Sie es erneut.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="content login">
      <h1>Zweiten Faktor einrichten</h1>
      <Card>
        {step.kind === 'intro' && (
          <>
            <p>
              Für Ihr Konto ist die Anmeldung mit einem zweiten Faktor verpflichtend. Richten Sie dazu eine Authenticator-App
              ein (zum Beispiel auf Ihrem Smartphone). Danach melden Sie sich einmal neu an.
            </p>
            {error && <p role="alert">{error}</p>}
            <Button onClick={() => void start()} disabled={busy}>Einrichtung starten</Button>
          </>
        )}
        {step.kind === 'scan' && (
          <form onSubmit={(event) => void confirm(event, step.setup)}>
            <p>Scannen Sie den QR-Code mit Ihrer Authenticator-App und geben Sie den angezeigten Code ein.</p>
            <QRCodeSVG value={step.setup.provisioning_uri} level="M" marginSize={2} size={192} bgColor="#ffffff" fgColor="#000000" title="QR-Code für die Authenticator-App" />
            <p>
              Schlüssel zur manuellen Eingabe: <code>{step.setup.secret_readable}</code>
            </p>
            <FormField label="Code aus der App" htmlFor="mfa-setup-code">
              <TextInput id="mfa-setup-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
            </FormField>
            {error && <p role="alert">{error}</p>}
            <Button type="submit" disabled={busy || code.trim() === ''}>Bestätigen</Button>
          </form>
        )}
        {step.kind === 'codes' && (
          <>
            <p>
              Die Authenticator-App ist eingerichtet. Bewahren Sie diese Wiederherstellungscodes sicher auf. Mit jedem Code
              können Sie sich einmal anmelden, falls Sie keinen Zugriff auf die App haben. Sie werden nur jetzt angezeigt.
            </p>
            <ul aria-label="Wiederherstellungscodes" className="recovery-codes">
              {step.codes.map((c) => (
                <li key={c}>
                  <code>{c}</code>
                </li>
              ))}
            </ul>
            <Button onClick={() => onReauthenticate(ENROLLED_NOTICE)}>Codes gesichert, neu anmelden</Button>
          </>
        )}
        {step.kind === 'already' && (
          <>
            <p>Für Ihr Konto ist bereits eine Authenticator-App eingerichtet. Diese Sitzung wurde aber ohne zweiten Faktor begonnen.</p>
            <Button onClick={() => onReauthenticate(ALREADY_ENROLLED_NOTICE)}>Neu anmelden</Button>
          </>
        )}
      </Card>
    </main>
  );
}
