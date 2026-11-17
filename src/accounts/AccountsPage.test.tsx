import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
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
    expect(screen.queryByLabelText('E-Mail')).not.toBeInTheDocument();
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
    await userEvent.type(screen.getByLabelText('E-Mail'), email);
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
    expect(screen.getByLabelText('E-Mail')).toHaveValue('');
  });

  it('laesst den Anmeldenamen weg, wenn er leer ist', async () => {
    const { client, calls } = fakeClient({ ...list(ADMIN), 'POST /api/accounts/invitations': { status: 201, data: { account: INVITED, invite_code: null } } });

    await invite(client, 'neu@schule.test');

    await screen.findByRole('status');
    expect(calls.find((c) => c.method === 'POST')?.data).toEqual({ email: 'neu@schule.test' });
  });

  it.each([
    ['username_taken', 409, 'Dieser Anmeldename ist schon vergeben'],
    ['email_taken', 409, 'Diese E-Mail-Adresse gehört schon zu einem anderen Konto'],
    ['already_active', 409, 'Dieses Konto ist schon aktiv'],
    ['account_inactive', 409, 'Dieses Konto ist deaktiviert'],
    ['invalid_email', 400, 'Die E-Mail-Adresse ist ungültig'],
    ['invalid_username', 400, 'Der Anmeldename ist ungültig'],
    ['auth_unavailable', 502, 'Der Anmeldedienst ist gerade nicht erreichbar']
  ])('uebersetzt den Code %s in einen verstaendlichen Text', async (code, status, text) => {
    const { client } = fakeClient({ ...list(ADMIN), 'POST /api/accounts/invitations': { status, data: { error: 'x', code } } });

    await invite(client, 'neu@schule.test');

    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(screen.getByLabelText('E-Mail')).toHaveValue('neu@schule.test');
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
