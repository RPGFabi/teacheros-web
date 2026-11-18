import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button, Card, FormField, TextInput } from '@hoelzle/react-ui';
import type { AxiosInstance } from 'axios';
import { statusLabel } from '../account/status';
import InvitationCards, { type InvitationCardData } from '../invitation/InvitationCards';
import AccountDetail from './AccountDetail';

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
  /** Eines der drei Verwaltungsrechte aus GET /api/me: ohne es gibt es keine Detailansicht (die API verweigert sie). */
  canViewAccess?: boolean;
  /** Recht `roles.assign` aus GET /api/me; ohne es sind Vergeben und Entziehen in der Detailansicht gesperrt. */
  canAssignRoles?: boolean;
  /** Schulname auf der Einladungskarte; Standard `VITE_APP_NAME`. */
  schoolName?: string;
  /** Web-Origin fuer den QR-Link der Einladungskarte; Standard `window.location.origin`. */
  origin?: string;
}

interface InvitationResponse {
  account: AccountRow;
  /** Nur bei Einladung ohne E-Mail und nur in dieser Antwort. */
  invite_code: string | null;
  /** ISO 8601, bis wann die Einladung gilt; null, wenn der Anmeldedienst es nicht nennt. */
  invite_expires_at?: string | null;
}

/** Verstaendliche Texte fuer die Fehlercodes der API (`{error, code}`). */
const ERROR_TEXT: Record<string, string> = {
  username_taken: 'Dieser Anmeldename ist schon vergeben. Bitte wählen Sie einen anderen.',
  email_taken: 'Diese E-Mail-Adresse gehört schon zu einem anderen Konto.',
  already_active: 'Dieses Konto ist schon aktiv und kann nicht erneut eingeladen werden.',
  account_inactive: 'Dieses Konto ist deaktiviert und kann nicht eingeladen werden.',
  account_not_found: 'Dieses Konto gibt es nicht mehr.',
  identifier_required: 'Bitte geben Sie eine E-Mail-Adresse oder einen Anmeldenamen an.',
  invalid_email: 'Die E-Mail-Adresse ist ungültig.',
  invalid_username: 'Der Anmeldename ist ungültig. Erlaubt sind 3 bis 64 Zeichen: Kleinbuchstaben, Ziffern, Punkt, Unterstrich und Bindestrich.',
  username_login_disabled: 'Konten ohne E-Mail-Adresse sind an dieser Schulinstanz nicht eingerichtet. Bitte geben Sie eine E-Mail-Adresse an.',
  account_disabled: 'Dieses Konto ist gesperrt und kann nicht eingeladen werden.',
  invalid_request: 'Die Anfrage wurde abgelehnt. Bitte prüfen Sie Ihre Angaben.',
  forbidden: 'Dafür fehlt Ihnen die Berechtigung.',
  auth_unavailable: 'Der Anmeldedienst ist gerade nicht erreichbar. Es wurde nichts angelegt; bitte versuchen Sie es gleich noch einmal.'
};

function describeFailure(err: unknown): string {
  const code = (err as { response?: { data?: { code?: unknown } } })?.response?.data?.code;
  return (typeof code === 'string' && ERROR_TEXT[code]) || 'Die Einladung konnte nicht gesendet werden. Bitte versuchen Sie es erneut.';
}

/** Daten der Einladungskarte zu einem Einladungscode der Antwort. */
function cardFor(data: InvitationResponse, code: string): InvitationCardData {
  return { loginName: data.account.login_name, code, validUntil: data.invite_expires_at };
}

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('de-DE') : '–';
}

export default function AccountsPage({
  apiClient,
  canInvite,
  canViewAccess = false,
  canAssignRoles = false,
  schoolName = import.meta.env.VITE_APP_NAME || 'Schulplattform',
  origin = window.location.origin
}: Props) {
  const [accounts, setAccounts] = useState<AccountRow[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [loginName, setLoginName] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Der Einladungscode lebt nur hier im Speicher: nach Schliessen oder der naechsten Aktion ist er weg.
  const [card, setCard] = useState<InvitationCardData | null>(null);

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
    setCard(null);
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
      const body = { ...(address && { email: address }), ...(name && { login_name: name }) };
      const { data } = await apiClient.post<InvitationResponse>('/api/accounts/invitations', body);
      setEmail('');
      setLoginName('');
      if (data.invite_code) {
        setCard(cardFor(data, data.invite_code));
        return `Einladung für ${data.account.login_name} erstellt.`;
      }
      return `Einladung an ${data.account.email ?? data.account.login_name} gesendet.`;
    });
  };

  const reinvite = (account: AccountRow) =>
    void run(async () => {
      const { data } = await apiClient.post<InvitationResponse>(`/api/accounts/${account.id}/reinvite`);
      if (data.invite_code) {
        setCard(cardFor(data, data.invite_code));
      }
      return `Erneut eingeladen: ${account.email ?? account.login_name}. Die vorige Einladung ist ungültig.`;
    });

  if (detailId !== null) {
    return <AccountDetail apiClient={apiClient} accountId={detailId} canAssign={canAssignRoles} onBack={() => setDetailId(null)} />;
  }

  return (
    <main className="content">
      <h1>Konten</h1>
      {canInvite && (
        <Card>
          <form onSubmit={submitInvite}>
            <h2>Konto einladen</h2>
            <FormField label="E-Mail (optional)" htmlFor="invite-email">
              <TextInput id="invite-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
            </FormField>
            <FormField label="Anmeldename (optional)" htmlFor="invite-login-name">
              <TextInput id="invite-login-name" autoComplete="off" value={loginName} onChange={(e) => setLoginName(e.target.value)} />
            </FormField>
            <p>
              Mit E-Mail-Adresse bekommt die Person die Einladung per Mail; ohne Anmeldenamen meldet sie sich mit der E-Mail-Adresse an.
              Ohne E-Mail-Adresse erscheint ein Einladungscode auf einer druckbaren Einladungskarte.
            </p>
            <Button type="submit" disabled={busy || (email.trim() === '' && loginName.trim() === '')}>Einladen</Button>
          </form>
        </Card>
      )}
      {notice && <p role="status">{notice}</p>}
      {card && (
        <section className="invitation-print" aria-label="Einladungskarte">
          <Card>
            <h2 className="screen-only">Einladungskarte</h2>
            <p className="screen-only">
              Der Einladungscode wird nur jetzt angezeigt und nirgends gespeichert. Drucken Sie die Karte aus, bevor Sie sie schließen.
            </p>
            <InvitationCards cards={[card]} schoolName={schoolName} origin={origin} />
            <p className="screen-only">
              <Button onClick={() => window.print()}>Karte drucken</Button>{' '}
              <Button variant="secondary" onClick={() => setCard(null)}>Karte schließen</Button>
            </p>
          </Card>
        </section>
      )}
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
                {(canInvite || canViewAccess) && <th scope="col">Aktion</th>}
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td>{account.email ?? '–'}</td>
                  <td>{account.login_name}</td>
                  <td>{statusLabel(account.status)}</td>
                  <td>{formatDate(account.invited_at)}</td>
                  {(canInvite || canViewAccess) && (
                    <td>
                      {canViewAccess && (
                        <Button
                          variant="secondary"
                          aria-label={`Rollen und Rechte: ${account.email ?? account.login_name}`}
                          onClick={() => setDetailId(account.id)}
                        >
                          Rollen und Rechte
                        </Button>
                      )}{' '}
                      {canInvite && account.status === 'invited' && (
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
