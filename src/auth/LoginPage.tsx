import { useState, type FormEvent } from 'react';
import { Button, Card, FormField, TextInput } from '@hoelzle/react-ui';
import { useAuth } from '@hoelzle/react-auth';

interface Challenge {
  token: string;
}

export default function LoginPage({ notice }: { notice?: string }) {
  const { login, verifyMfaChallenge } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>, failure: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  const submitLogin = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const result = await login(email, password);
      if (result.status === 'mfa_required') {
        setChallenge({ token: result.challengeToken });
      }
    }, 'Anmeldung fehlgeschlagen. Bitte E-Mail bzw. Anmeldename und Passwort prüfen.');
  };

  const submitCode = (event: FormEvent) => {
    event.preventDefault();
    if (!challenge) return;
    void run(() => verifyMfaChallenge(challenge.token, code, false), 'Anmeldung fehlgeschlagen. Der Code ist ungültig oder abgelaufen.');
  };

  return (
    <main className="content login">
      <h1>Anmelden</h1>
      {notice && <p role="status">{notice}</p>}
      <Card>
        {challenge ? (
          <form onSubmit={submitCode}>
            <p>Bitte geben Sie den Code aus Ihrer Authenticator-App ein.</p>
            <FormField label="Code" htmlFor="mfa-code">
              <TextInput id="mfa-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
            </FormField>
            {error && <p role="alert">{error}</p>}
            <Button type="submit" disabled={busy}>Bestätigen</Button>
          </form>
        ) : (
          <form onSubmit={submitLogin}>
            <FormField label="E-Mail oder Anmeldename" htmlFor="login-email">
              <TextInput id="login-email" type="text" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
            </FormField>
            <FormField label="Passwort" htmlFor="login-password">
              <TextInput id="login-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </FormField>
            {error && <p role="alert">{error}</p>}
            <Button type="submit" disabled={busy}>Anmelden</Button>
          </form>
        )}
      </Card>
    </main>
  );
}
