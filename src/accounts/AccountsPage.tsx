import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button, Card, FormField, TextInput } from '@hoelzle/react-ui';
import type { AxiosInstance } from 'axios';

export interface AccountRow {
  id: string;
  email: string | null;
  login_name: string;
  status: 'invited' | 'active' | 'inactive' | string;
  /** ISO 8601 (UTC) oder null, wenn das Konto nie eingeladen wurde. */
  invited_at: string | null;
}

interface Props {
  apiClient: AxiosInstance;
  /** Recht `accounts.invite` aus GET /api/me; ohne es gibt es keine Einladen-Schaltflaechen. */
  canInvite: boolean;
}

const STATUS_LABEL: Record<string, string> = { active: 'Aktiv', invited: 'Eingeladen', inactive: 'Inaktiv' };

/** Verstaendliche Texte fuer die Fehlercodes der API (`{error, code}`). */
const ERROR_TEXT: Record<string, string> = {
  username_taken: 'Dieser Anmeldename ist schon vergeben. Bitte wählen Sie einen anderen.',
  email_taken: 'Diese E-Mail-Adresse gehört schon zu einem anderen Konto.',
  already_active: 'Dieses Konto ist schon aktiv und kann nicht erneut eingeladen werden.',
  account_inactive: 'Dieses Konto ist deaktiviert und kann nicht eingeladen werden.',
  account_not_found: 'Dieses Konto gibt es nicht mehr.',
  email_required: 'Bitte geben Sie eine E-Mail-Adresse an.',
  invalid_email: 'Die E-Mail-Adresse ist ungültig.',
  invalid_username: 'Der Anmeldename ist ungültig. Erlaubt sind 3 bis 64 Zeichen: Kleinbuchstaben, Ziffern, Punkt, Unterstrich und Bindestrich.',
  forbidden: 'Dafür fehlt Ihnen die Berechtigung.',
  auth_unavailable: 'Der Anmeldedienst ist gerade nicht erreichbar. Es wurde nichts angelegt; bitte versuchen Sie es gleich noch einmal.'
};

function describeFailure(err: unknown): string {
  const code = (err as { response?: { data?: { code?: unknown } } })?.response?.data?.code;
  return (typeof code === 'string' && ERROR_TEXT[code]) || 'Die Einladung konnte nicht gesendet werden. Bitte versuchen Sie es erneut.';
}

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('de-DE') : '–';
}

export default function AccountsPage({ apiClient, canInvite }: Props) {
  const [accounts, setAccounts] = useState<AccountRow[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [email, setEmail] = useState('');
  const [loginName, setLoginName] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const response = await apiClient.get<{ accounts: AccountRow[] }>('/api/accounts');
      setAccounts(response.data.accounts);
    } catch {
      setLoadError(true);
    }
  }, [apiClient]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<string>) {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      setNotice(await action());
      await load();
    } catch (err) {
      setError(describeFailure(err));
    } finally {
      setBusy(false);
    }
  }

  const submitInvite = (event: FormEvent) => {
    event.preventDefault();
    const address = email.trim();
    const name = loginName.trim();
    void run(async () => {
      await apiClient.post('/api/accounts/invitations', name ? { email: address, login_name: name } : { email: address });
      setEmail('');
      setLoginName('');
      return `Einladung an ${address} gesendet.`;
    });
  };

  const reinvite = (account: AccountRow) =>
    void run(async () => {
      await apiClient.post(`/api/accounts/${account.id}/reinvite`);
      return `Erneut eingeladen: ${account.email ?? account.login_name}. Die vorige Einladung ist ungültig.`;
    });

  return (
    <main className="content">
      <h1>Konten</h1>
      {canInvite && (
        <Card>
          <form onSubmit={submitInvite}>
            <h2>Konto einladen</h2>
            <FormField label="E-Mail" htmlFor="invite-email">
              <TextInput id="invite-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
            </FormField>
            <FormField label="Anmeldename (optional)" htmlFor="invite-login-name">
              <TextInput id="invite-login-name" autoComplete="off" value={loginName} onChange={(e) => setLoginName(e.target.value)} />
            </FormField>
            <p>Ohne Anmeldenamen meldet sich die Person mit ihrer E-Mail-Adresse an.</p>
            <Button type="submit" disabled={busy || email.trim() === ''}>Einladen</Button>
          </form>
        </Card>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      <Card>
        {loadError && (
          <>
            <p role="alert">Die Konten konnten nicht geladen werden.</p>
            <Button variant="secondary" onClick={() => void load()}>Erneut laden</Button>
          </>
        )}
        {!loadError && accounts === null && <p>Konten werden geladen …</p>}
        {accounts !== null && accounts.length === 0 && !loadError && <p>Es gibt noch keine Konten.</p>}
        {accounts !== null && accounts.length > 0 && (
          <table>
            <thead>
              <tr>
                <th scope="col">E-Mail</th>
                <th scope="col">Anmeldename</th>
                <th scope="col">Status</th>
                <th scope="col">Eingeladen am</th>
                {canInvite && <th scope="col">Aktion</th>}
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td>{account.email ?? '–'}</td>
                  <td>{account.login_name}</td>
                  <td>{STATUS_LABEL[account.status] ?? account.status}</td>
                  <td>{formatDate(account.invited_at)}</td>
                  {canInvite && (
                    <td>
                      {account.status === 'invited' && (
                        <Button
                          variant="secondary"
                          disabled={busy}
                          aria-label={`Erneut einladen: ${account.email ?? account.login_name}`}
                          onClick={() => reinvite(account)}
                        >
                          Erneut einladen
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </main>
  );
}
