import { useState, type FormEvent } from 'react';
import { Button, Card, FormField, TextInput } from '@hoelzle/react-ui';
import type { AxiosInstance } from 'axios';

interface Props {
  /** Client der Auth-Instanz der eigenen Schule; die Annahme geht direkt dorthin, nicht ueber die API. */
  authClient: AxiosInstance;
  /** `?token=` aus dem Link der Einladungsmail. */
  token?: string;
  /** `?code=` aus dem QR-Code der Einladungskarte (Einladung ohne E-Mail). */
  code?: string;
  /** Wird nach erfolgreicher Annahme aufgerufen; der Aufrufer leitet zur Anmeldung. */
  onAccepted: () => void;
}

const LINK_INVALID =
  'Der Link ist abgelaufen oder wurde schon benutzt. Bitte lassen Sie sich von der Schuladministration eine neue Einladung senden.';
const CODE_INVALID =
  'Der Einladungscode ist ungültig, abgelaufen oder wurde schon benutzt. Bitte lassen Sie sich von der Schuladministration eine neue Einladung geben.';

export default function InvitationPage({ authClient, token, code, onAccepted }: Props) {
  const [typedCode, setTypedCode] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const needsCode = !token && !code;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== repeat) {
      setError('Die beiden Passwörter stimmen nicht überein.');
      return;
    }
    const credential = token ? { token } : { code: (code ?? typedCode).trim() };
    if (!token && !credential.code) {
      setError('Bitte geben Sie den Einladungscode von Ihrer Einladungskarte ein.');
      return;
    }

    setBusy(true);
    try {
      await authClient.post('/acceptInvite', { ...credential, password });
      onAccepted();
    } catch (err) {
      setError(describeFailure(err, token ? LINK_INVALID : CODE_INVALID));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="content login">
      <h1>Einladung annehmen</h1>
      <Card>
        <form onSubmit={submit}>
          <p>Legen Sie ein Passwort fest, um Ihr Konto einzurichten. Danach melden Sie sich an.</p>
          {needsCode && (
            <FormField label="Einladungscode" htmlFor="invite-code">
              <TextInput id="invite-code" autoComplete="off" autoCapitalize="characters" value={typedCode} onChange={(e) => setTypedCode(e.target.value)} />
            </FormField>
          )}
          <FormField label="Passwort" htmlFor="invite-password">
            <TextInput id="invite-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </FormField>
          <FormField label="Passwort wiederholen" htmlFor="invite-password-repeat">
            <TextInput id="invite-password-repeat" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
          </FormField>
          {error && <p role="alert">{error}</p>}
          <Button type="submit" disabled={busy}>Passwort setzen</Button>
        </form>
      </Card>
    </main>
  );
}

/** 400 mit Passwortregel: Meldung des Anmeldedienstes zeigen; sonstige 400: Link/Code unbrauchbar. */
function describeFailure(err: unknown, linkInvalid: string): string {
  const response = (err as { response?: { status?: number; data?: { error?: unknown } } })?.response;
  if (response?.status === 400) {
    const message = response.data?.error;
    return typeof message === 'string' && message.startsWith('Das Passwort') ? message : linkInvalid;
  }
  if (response?.status === 429) {
    return 'Zu viele Versuche. Bitte warten Sie einen Moment und versuchen Sie es erneut.';
  }
  return 'Der Anmeldedienst ist nicht erreichbar. Bitte versuchen Sie es später erneut.';
}
