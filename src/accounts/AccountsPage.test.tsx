import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AccountsPage from './AccountsPage';
import { fakeClient } from '../test/fakeHttp';

const ADMIN = { id: '11111111-1111-4111-8111-111111111111', email: 'admin@schule.test', login_name: 'admin', status: 'active', invited_at: '2026-11-10T12:00:00+00:00' };
const INVITED = { id: '22222222-2222-4222-8222-222222222222', email: 'neu@schule.test', login_name: 'max.muster', status: 'invited', invited_at: '2026-11-12T12:00:00+00:00' };
const INACTIVE = { id: '33333333-3333-4333-8333-333333333333', email: null, login_name: 'sperre', status: 'inactive', invited_at: null };

const list = (...accounts: unknown[]) => ({ 'GET /api/accounts': { data: { accounts } } });

describe('Konten: Liste', () => {
  it('zeigt waehrend des Ladens einen Hinweis und danach E-Mail, Anmeldename, Status und Eingeladen-am', async () => {
    const { client } = fakeClient(list(ADMIN, INVITED, INACTIVE));
    render(<AccountsPage apiClient={client} canInvite />);

    expect(screen.getByText('Konten werden geladen …')).toBeInTheDocument();

    const row = (await screen.findByText('neu@schule.test', { selector: 'td' })).closest('tr')!;
    expect(within(row).getByText('max.muster')).toBeInTheDocument();
    expect(within(row).getByText('Eingeladen')).toBeInTheDocument();
    expect(within(row).getByText('12.11.2026')).toBeInTheDocument();
    expect(screen.getByText('Aktiv')).toBeInTheDocument();
    expect(screen.getByText('Inaktiv')).toBeInTheDocument();
  });

  it('zeigt bei einem Ladefehler eine Meldung und laedt auf Wunsch erneut', async () => {
    let attempts = 0;
    const { client } = fakeClient({
      'GET /api/accounts': () => (++attempts === 1 ? { status: 500 } : { data: { accounts: [ADMIN] } })
    });
    render(<AccountsPage apiClient={client} canInvite />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Die Konten konnten nicht geladen werden');
    await userEvent.click(screen.getByRole('button', { name: 'Erneut laden' }));

    expect(await screen.findByText('admin@schule.test', { selector: 'td' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Konten: Rechte', () => {
  it('zeigt ohne accounts.invite weder das Einladen-Formular noch Erneut-einladen-Schaltflaechen', async () => {
    const { client } = fakeClient(list(ADMIN, INVITED));
    render(<AccountsPage apiClient={client} canInvite={false} />);

    await screen.findByText('neu@schule.test', { selector: 'td' });
    expect(screen.queryByRole('button', { name: 'Einladen' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('E-Mail (optional)')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Erneut einladen/ })).not.toBeInTheDocument();
  });

  it('bietet Erneut einladen nur fuer Konten im Status eingeladen', async () => {
    const { client } = fakeClient(list(ADMIN, INVITED, INACTIVE));
    render(<AccountsPage apiClient={client} canInvite />);

    await screen.findByText('neu@schule.test', { selector: 'td' });
    expect(screen.getAllByRole('button', { name: /Erneut einladen/ })).toHaveLength(1);
  });
});

describe('Konten: Einladen', () => {
  async function invite(client: ReturnType<typeof fakeClient>['client'], email: string, loginName?: string) {
    render(<AccountsPage apiClient={client} canInvite />);
    await screen.findByText('admin@schule.test', { selector: 'td' });
    await userEvent.type(screen.getByLabelText('E-Mail (optional)'), email);
    if (loginName) await userEvent.type(screen.getByLabelText('Anmeldename (optional)'), loginName);
    await userEvent.click(screen.getByRole('button', { name: 'Einladen' }));
  }

  it('sendet E-Mail und optionalen Anmeldenamen, meldet den Erfolg und zeigt das neue Konto', async () => {
    let accounts = [ADMIN];
    const { client, calls } = fakeClient({
      'GET /api/accounts': () => ({ data: { accounts } }),
      'POST /api/accounts/invitations': () => {
        accounts = [...accounts, INVITED];
        return { status: 201, data: { account: INVITED, invite_code: null } };
      }
    });

    await invite(client, 'neu@schule.test', 'max.muster');

    expect(await screen.findByRole('status')).toHaveTextContent('Einladung an neu@schule.test gesendet');
    expect(calls.find((c) => c.method === 'POST')?.data).toEqual({ email: 'neu@schule.test', login_name: 'max.muster' });
    expect(await screen.findByText('max.muster', { selector: 'td' })).toBeInTheDocument();
    expect(screen.getByLabelText('E-Mail (optional)')).toHaveValue('');
  });

  it('laesst den Anmeldenamen weg, wenn er leer ist', async () => {
    const { client, calls } = fakeClient({ ...list(ADMIN), 'POST /api/accounts/invitations': { status: 201, data: { account: INVITED, invite_code: null } } });

    await invite(client, 'neu@schule.test');

    await screen.findByRole('status');
    expect(calls.find((c) => c.method === 'POST')?.data).toEqual({ email: 'neu@schule.test' });
  });

  it('verlangt E-Mail oder Anmeldename: ohne beides ist Einladen gesperrt', async () => {
    const { client } = fakeClient(list(ADMIN));
    render(<AccountsPage apiClient={client} canInvite />);
    await screen.findByText('admin@schule.test', { selector: 'td' });

    expect(screen.getByRole('button', { name: 'Einladen' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Anmeldename (optional)'), 'nur-name');
    expect(screen.getByRole('button', { name: 'Einladen' })).toBeEnabled();
  });

  it.each([
    ['username_taken', 409, 'Dieser Anmeldename ist schon vergeben'],
    ['email_taken', 409, 'Diese E-Mail-Adresse gehört schon zu einem anderen Konto'],
    ['already_active', 409, 'Dieses Konto ist schon aktiv'],
    ['account_inactive', 409, 'Dieses Konto ist deaktiviert'],
    ['identifier_required', 400, 'Bitte geben Sie eine E-Mail-Adresse oder einen Anmeldenamen an'],
    ['invalid_email', 400, 'Die E-Mail-Adresse ist ungültig'],
    ['invalid_username', 400, 'Der Anmeldename ist ungültig'],
    ['username_login_disabled', 400, 'Konten ohne E-Mail-Adresse'],
    ['account_disabled', 409, 'Dieses Konto ist gesperrt'],
    ['invalid_request', 400, 'Die Anfrage wurde abgelehnt'],
    ['auth_unavailable', 502, 'Der Anmeldedienst ist gerade nicht erreichbar']
  ])('uebersetzt den Code %s in einen verstaendlichen Text', async (code, status, text) => {
    const { client } = fakeClient({ ...list(ADMIN), 'POST /api/accounts/invitations': { status, data: { error: 'x', code } } });

    await invite(client, 'neu@schule.test');

    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(screen.getByLabelText('E-Mail (optional)')).toHaveValue('neu@schule.test');
  });

  it('zeigt bei unbekanntem Fehler eine allgemeine Meldung', async () => {
    const { client } = fakeClient({ ...list(ADMIN), 'POST /api/accounts/invitations': { status: 500 } });

    await invite(client, 'neu@schule.test');

    expect(await screen.findByRole('alert')).toHaveTextContent('Die Einladung konnte nicht gesendet werden');
  });
});

describe('Konten: Erneut einladen', () => {
  it('ruft reinvite fuer das Konto auf, meldet den Erfolg und aktualisiert die Liste', async () => {
    const { client, calls } = fakeClient({
      ...list(INVITED),
      [`POST /api/accounts/${INVITED.id}/reinvite`]: { data: { account: { ...INVITED, invited_at: '2026-11-15T12:00:00+00:00' }, invite_code: null } }
    });
    render(<AccountsPage apiClient={client} canInvite />);

    await userEvent.click(await screen.findByRole('button', { name: 'Erneut einladen: neu@schule.test' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Erneut eingeladen: neu@schule.test');
    expect(calls.filter((c) => c.method === 'GET')).toHaveLength(2);
  });

  it('zeigt Fehlercodes als verstaendlichen Text', async () => {
    const { client } = fakeClient({
      ...list(INVITED),
      [`POST /api/accounts/${INVITED.id}/reinvite`]: { status: 409, data: { error: 'x', code: 'already_active' } }
    });
    render(<AccountsPage apiClient={client} canInvite />);

    await userEvent.click(await screen.findByRole('button', { name: /Erneut einladen/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Dieses Konto ist schon aktiv');
  });
});

describe('Konten: Einladung per Anmeldename mit Einladungskarte', () => {
  const PUPIL = { id: '44444444-4444-4444-8444-444444444444', email: null, login_name: 'schueler.eins', status: 'invited', invited_at: '2026-11-17T12:00:00+00:00' };
  const CODE = 'ABCD-EFGH-JKMN-PQRS';
  const renderPage = (client: ReturnType<typeof fakeClient>['client']) =>
    render(<AccountsPage apiClient={client} canInvite schoolName="Goethe-Schule" origin="https://schule.example.test" />);

  async function invitePupil(client: ReturnType<typeof fakeClient>['client']) {
    renderPage(client);
    await screen.findByText('admin@schule.test', { selector: 'td' });
    await userEvent.type(screen.getByLabelText('Anmeldename (optional)'), 'schueler.eins');
    await userEvent.click(screen.getByRole('button', { name: 'Einladen' }));
  }

  it('sendet nur den Anmeldenamen und zeigt den Code auf einer Einladungskarte mit QR-Link', async () => {
    const { client, calls } = fakeClient({ ...list(ADMIN), 'POST /api/accounts/invitations': { status: 201, data: { account: PUPIL, invite_code: CODE } } });

    await invitePupil(client);

    const card = await screen.findByRole('article');
    expect(calls.find((c) => c.method === 'POST')?.data).toEqual({ login_name: 'schueler.eins' });
    expect(within(card).getByText(CODE)).toBeInTheDocument();
    expect(within(card).getByText('schueler.eins')).toBeInTheDocument();
    expect(within(card).getByText('Goethe-Schule')).toBeInTheDocument();
    expect(within(card).getByTestId('invitation-qr')).toHaveAttribute('data-qr-value', `https://schule.example.test/einladung?code=${CODE}`);
    expect(screen.getByRole('status')).toHaveTextContent('Einladung für schueler.eins erstellt');
    expect(screen.getByText(/nur jetzt angezeigt/)).toBeInTheDocument();
  });

  it('zeigt auf der Karte, bis wann die Einladung gilt', async () => {
    const { client } = fakeClient({ ...list(ADMIN), 'POST /api/accounts/invitations': { status: 201, data: { account: PUPIL, invite_code: CODE, invite_expires_at: '2026-11-20T12:34:56Z' } } });

    await invitePupil(client);

    const card = await screen.findByRole('article');
    expect(within(card).getByText('gültig bis 20.11.2026')).toBeInTheDocument();
  });

  it('laesst "gültig bis" weg, wenn die API kein Ablaufdatum nennt', async () => {
    const { client } = fakeClient({ ...list(ADMIN), 'POST /api/accounts/invitations': { status: 201, data: { account: PUPIL, invite_code: CODE, invite_expires_at: null } } });

    await invitePupil(client);

    expect(within(await screen.findByRole('article')).queryByText(/gültig bis/)).not.toBeInTheDocument();
  });

  it('Erneut einladen zeigt das neue Ablaufdatum auf der Karte', async () => {
    const { client } = fakeClient({
      ...list(PUPIL),
      [`POST /api/accounts/${PUPIL.id}/reinvite`]: { data: { account: PUPIL, invite_code: 'WXYZ-2345-6789-ABCD', invite_expires_at: '2026-11-21T08:00:00Z' } }
    });
    renderPage(client);

    await userEvent.click(await screen.findByRole('button', { name: 'Erneut einladen: schueler.eins' }));

    expect(within(await screen.findByRole('article')).getByText('gültig bis 21.11.2026')).toBeInTheDocument();
  });

  it('nennt in der Erfolgsmeldung den Anmeldenamen, wenn es weder Code noch E-Mail gibt', async () => {
    const { client } = fakeClient({ ...list(ADMIN), 'POST /api/accounts/invitations': { status: 201, data: { account: PUPIL, invite_code: null } } });

    await invitePupil(client);

    expect(await screen.findByRole('status')).toHaveTextContent('Einladung an schueler.eins gesendet.');
  });

  it('zeigt den Code genau einmal: nach Schliessen ist er weg und kommt nicht wieder', async () => {
    let accounts = [ADMIN];
    const { client } = fakeClient({
      'GET /api/accounts': () => ({ data: { accounts } }),
      'POST /api/accounts/invitations': () => {
        accounts = [...accounts, PUPIL];
        return { status: 201, data: { account: PUPIL, invite_code: CODE } };
      }
    });
    await invitePupil(client);
    await screen.findByRole('article');

    await userEvent.click(screen.getByRole('button', { name: 'Karte schließen' }));

    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(await screen.findByText('schueler.eins', { selector: 'td' })).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(CODE);
  });

  it('druckt die Karte ueber den Browser-Druckdialog', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const { client } = fakeClient({ ...list(ADMIN), 'POST /api/accounts/invitations': { status: 201, data: { account: PUPIL, invite_code: CODE } } });
    await invitePupil(client);

    await userEvent.click(await screen.findByRole('button', { name: 'Karte drucken' }));

    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
  });

  it('zeigt bei Einladung mit E-Mail (ohne Code) keine Karte', async () => {
    const { client } = fakeClient({ ...list(ADMIN), 'POST /api/accounts/invitations': { status: 201, data: { account: INVITED, invite_code: null } } });
    renderPage(client);
    await screen.findByText('admin@schule.test', { selector: 'td' });
    await userEvent.type(screen.getByLabelText('E-Mail (optional)'), 'neu@schule.test');
    await userEvent.click(screen.getByRole('button', { name: 'Einladen' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Einladung an neu@schule.test gesendet.');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('Erneut einladen ohne E-Mail zeigt die Karte mit dem neuen Code', async () => {
    const { client } = fakeClient({
      ...list(PUPIL),
      [`POST /api/accounts/${PUPIL.id}/reinvite`]: { data: { account: PUPIL, invite_code: 'WXYZ-2345-6789-ABCD' } }
    });
    renderPage(client);

    await userEvent.click(await screen.findByRole('button', { name: 'Erneut einladen: schueler.eins' }));

    const card = await screen.findByRole('article');
    expect(within(card).getByText('WXYZ-2345-6789-ABCD')).toBeInTheDocument();
    expect(within(card).getByTestId('invitation-qr')).toHaveAttribute('data-qr-value', 'https://schule.example.test/einladung?code=WXYZ-2345-6789-ABCD');
    expect(screen.getByRole('status')).toHaveTextContent('Erneut eingeladen: schueler.eins');
  });
});
