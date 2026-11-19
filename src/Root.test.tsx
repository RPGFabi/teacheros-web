import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Root from './Root';
import { fakeClient } from './test/fakeHttp';

const ME = {
  account: { id: '11111111-1111-4111-8111-111111111111', status: 'active', mfa_required: false },
  permissions: [] as string[],
  session: { used_mfa: false, expires_at: '2026-11-17T12:00:00+00:00' }
};

function setup(authRoutes = {}, apiRoutes = {}) {
  const auth = fakeClient({ 'POST /refresh': { status: 401 }, ...authRoutes });
  const api = fakeClient({ 'GET /api/me': { data: ME }, ...apiRoutes });
  render(<Root authClient={auth.client} apiClient={api.client} />);
  return { auth, api };
}

async function fillLogin(email = 'lehrer@example.test', password = 'geheim123') {
  await userEvent.type(await screen.findByLabelText('E-Mail oder Anmeldename'), email);
  await userEvent.type(screen.getByLabelText('Passwort'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));
}

describe('Anmeldung und Mein Konto', () => {
  beforeEach(() => localStorage.clear());

  it('zeigt ohne Sitzung das Anmeldeformular statt der Portale', async () => {
    setup();
    expect(await screen.findByRole('heading', { level: 1, name: 'Anmelden' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Hauptnavigation' })).not.toBeInTheDocument();
  });

  it('meldet an und zeigt Mein Konto mit den Daten aus GET /api/me', async () => {
    const { api } = setup({ 'POST /login': { data: { token: 'jwt-1', email: 'lehrer@example.test' } } });

    await fillLogin();

    expect(await screen.findByRole('heading', { level: 1, name: 'Mein Konto' })).toBeInTheDocument();
    expect(await screen.findByText(ME.account.id)).toBeInTheDocument();
    expect(screen.getByText('lehrer@example.test')).toBeInTheDocument();
    expect(screen.getByText('Aktiv')).toBeInTheDocument();
    expect(api.calls.find((c) => c.url === '/api/me')?.authorization).toBe('Bearer jwt-1');
  });

  it('nimmt im Login-Feld auch einen Anmeldenamen an und sendet ihn als Kennung im Feld email', async () => {
    const { auth } = setup({ 'POST /login': { data: { token: 'jwt-3', email: 'schueler.eins' } } });

    expect(await screen.findByLabelText('E-Mail oder Anmeldename')).toHaveAttribute('type', 'text');
    await fillLogin('schueler.eins');

    expect(await screen.findByRole('heading', { level: 1, name: 'Mein Konto' })).toBeInTheDocument();
    expect(auth.calls.find((c) => c.url === '/login')?.data).toMatchObject({ email: 'schueler.eins', password: 'geheim123' });
  });

  it('fuehrt bei aktivierter MFA durch die Challenge und zeigt danach Mein Konto', async () => {
    const { auth } = setup({
      'POST /login': { data: { mfa_required: true, challenge_token: 'c-1', challenge_expires_in: 300, methods: ['totp'] } },
      'POST /mfa/challenge/verify': { data: { token: 'jwt-2', email: 'lehrer@example.test' } }
    });

    await fillLogin();
    await userEvent.type(await screen.findByLabelText('Code'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Bestätigen' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Mein Konto' })).toBeInTheDocument();
    expect(auth.calls.find((c) => c.url === '/mfa/challenge/verify')?.data).toMatchObject({ challenge_token: 'c-1', code: '123456' });
  });

  it('meldet bei falschen Zugangsdaten einen Fehler und bleibt im Formular', async () => {
    setup({ 'POST /login': { status: 401, data: { error: 'Invalid credentials' } } });

    await fillLogin('lehrer@example.test', 'falsch');

    expect(await screen.findByRole('alert')).toHaveTextContent('Anmeldung fehlgeschlagen. Bitte E-Mail bzw. Anmeldename und Passwort prüfen.');
    expect(screen.getByRole('heading', { level: 1, name: 'Anmelden' })).toBeInTheDocument();
  });

  it('erklaert bei account_disabled mit reason admin_locked, dass die Verwaltung das Konto gesperrt hat', async () => {
    setup({
      'POST /login': {
        status: 403,
        data: { error: 'Dein Account ist noch nicht aktiv.', code: 'account_disabled', reason: 'admin_locked' }
      }
    });

    await fillLogin();

    expect(await screen.findByRole('alert')).toHaveTextContent('Ihr Konto wurde von der Verwaltung gesperrt. Bitte wenden Sie sich an Ihre Schule.');
    expect(screen.getByRole('heading', { level: 1, name: 'Anmelden' })).toBeInTheDocument();
  });

  it.each([['security_lock'], [undefined]])('nennt bei account_disabled mit reason %s nur, dass das Konto gesperrt ist', async (reason) => {
    setup({ 'POST /login': { status: 403, data: { error: 'Dein Account ist noch nicht aktiv.', code: 'account_disabled', reason } } });

    await fillLogin();

    expect(await screen.findByRole('alert')).toHaveTextContent(/^Ihr Konto ist gesperrt\.$/);
  });

  it('zeigt bei einer Antwort ohne account_disabled weiter die allgemeine Anmeldemeldung', async () => {
    setup({ 'POST /login': { status: 403, data: { error: 'Dein Account ist noch nicht aktiv.' } } });

    await fillLogin();

    expect(await screen.findByRole('alert')).toHaveTextContent('Anmeldung fehlgeschlagen. Bitte E-Mail bzw. Anmeldename und Passwort prüfen.');
  });

  it('meldet ueber Abmelden ab und zeigt wieder das Anmeldeformular', async () => {
    const { auth } = setup({
      'POST /login': { data: { token: 'jwt-1', email: 'lehrer@example.test' } },
      'POST /logout': { data: {} }
    });
    await fillLogin();
    await screen.findByRole('heading', { level: 1, name: 'Mein Konto' });

    await userEvent.click(screen.getByRole('button', { name: 'Abmelden' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Anmelden' })).toBeInTheDocument();
    expect(auth.calls.some((c) => c.method === 'POST' && c.url === '/logout')).toBe(true);
  });

  it('zeigt nach der Anmeldung Konten, wenn /api/me das Recht accounts.view liefert', async () => {
    setup(
      { 'POST /login': { data: { token: 'jwt-1', email: 'admin@example.test' } } },
      { 'GET /api/me': { data: { ...ME, permissions: ['accounts.view', 'accounts.invite'] } } }
    );

    await fillLogin('admin@example.test');

    const nav = await screen.findByRole('navigation', { name: 'Hauptnavigation' });
    expect(await within(nav).findByRole('link', { name: 'Konten' })).toBeInTheDocument();
  });

  it('zeigt Konten nicht fuer ein Konto ohne Rechte', async () => {
    setup({ 'POST /login': { data: { token: 'jwt-1', email: 'lehrer@example.test' } } });

    await fillLogin();

    await screen.findByRole('heading', { level: 1, name: 'Mein Konto' });
    expect(screen.queryByRole('link', { name: 'Konten' })).not.toBeInTheDocument();
  });
});

describe('Laufende Sitzung einer gesperrten Person', () => {
  beforeEach(() => localStorage.clear());

  const LOGIN = { 'POST /login': { data: { token: 'jwt-1', email: 'lehrer@example.test' } }, 'POST /logout': { data: {} } };

  it('meldet bei 401 account_inactive ab und nennt bei admin_locked die Sperre durch die Verwaltung', async () => {
    // Der Anmeldedienst widerruft beim Sperren die Refresh-Tokens: die Erneuerung scheitert (Standard-Route 401).
    const { auth } = setup(LOGIN, { 'GET /api/me': { status: 401, data: { error: 'Account inactive', code: 'account_inactive', reason: 'admin_locked' } } });

    await fillLogin();

    expect(await screen.findByRole('heading', { level: 1, name: 'Anmelden' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Ihr Konto wurde von der Verwaltung gesperrt. Bitte wenden Sie sich an Ihre Schule.');
    expect(screen.queryByRole('navigation', { name: 'Hauptnavigation' })).not.toBeInTheDocument();
    expect(auth.calls.some((c) => c.method === 'POST' && c.url === '/logout')).toBe(true);
  });

  it('nennt bei account_inactive ohne bekannten Grund nur, dass das Konto gesperrt ist, auch wenn die Erneuerung noch klappt', async () => {
    setup(
      { ...LOGIN, 'POST /refresh': { data: { token: 'jwt-2', email: 'lehrer@example.test' } } },
      { 'GET /api/me': { status: 401, data: { error: 'Account inactive', code: 'account_inactive', reason: null } } }
    );

    await fillLogin();

    expect(await screen.findByRole('status')).toHaveTextContent(/^Ihr Konto ist gesperrt\.$/);
    expect(screen.getByRole('heading', { level: 1, name: 'Anmelden' })).toBeInTheDocument();
  });

  it('meldet bei 401 session_revoked ohne Sperrhinweis ab, ohne die Sitzung noch zu erneuern', async () => {
    const { auth } = setup({ ...LOGIN, 'POST /refresh': { data: { token: 'jwt-2', email: 'lehrer@example.test' } } }, { 'GET /api/me': { status: 401, data: { error: 'Session revoked', code: 'session_revoked' } } });

    await fillLogin();

    expect(await screen.findByRole('heading', { level: 1, name: 'Anmelden' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(auth.calls.filter((c) => c.url === '/refresh')).toHaveLength(0);
  });

  it('erkennt die Sperre auch bei einem spaeteren API-Aufruf, nicht nur bei /api/me', async () => {
    let locked = false;
    const { api } = setup(LOGIN, {
      'GET /api/me': () => (locked ? { status: 401, data: { code: 'account_inactive', reason: 'admin_locked' } } : { data: { ...ME, permissions: ['accounts.view', 'accounts.invite'] } }),
      'GET /api/accounts': () => ({ status: 401, data: { code: 'account_inactive', reason: 'admin_locked' } })
    });
    await fillLogin();
    const nav = await screen.findByRole('navigation', { name: 'Hauptnavigation' });
    locked = true;

    await userEvent.click(within(nav).getByRole('link', { name: 'Konten' }));

    expect(await screen.findByRole('status')).toHaveTextContent('von der Verwaltung gesperrt');
    expect(api.calls.some((c) => c.url === '/api/accounts')).toBe(true);
  });

  it('zeigt den Sperrhinweis nach erneuter Anmeldung und spaeterem Abmelden nicht mehr', async () => {
    let attempt = 0;
    setup(LOGIN, {
      'GET /api/me': () => (attempt++ === 0 ? { status: 401, data: { code: 'account_inactive', reason: 'admin_locked' } } : { data: ME })
    });
    await fillLogin();
    await screen.findByRole('status');

    await fillLogin();
    await screen.findByRole('heading', { level: 1, name: 'Mein Konto' });
    await userEvent.click(screen.getByRole('button', { name: 'Abmelden' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Anmelden' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('Seite /einladung (oeffentlich, ohne Anmeldung)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('nimmt die Einladung ueber ?token= an und leitet danach zur Anmeldung mit Hinweis', async () => {
    window.history.pushState(null, '', '/einladung?token=tok-1');
    const { auth } = setup({ 'POST /acceptInvite': { data: { ok: 'Dein Konto ist eingerichtet.' } } });

    await userEvent.type(await screen.findByLabelText('Passwort'), 'Neues!Passwort22');
    await userEvent.type(screen.getByLabelText('Passwort wiederholen'), 'Neues!Passwort22');
    await userEvent.click(screen.getByRole('button', { name: 'Passwort setzen' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Anmelden' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Ihr Passwort ist gesetzt');
    expect(auth.calls.find((c) => c.url === '/acceptInvite')?.data).toEqual({ token: 'tok-1', password: 'Neues!Passwort22' });
    expect(window.location.pathname).toBe('/');
  });

  it('nutzt ?code= aus dem QR-Code der Einladungskarte', async () => {
    window.history.pushState(null, '', '/einladung?code=ABCD-EFGH-JKMN-PQRS');
    const { auth } = setup({ 'POST /acceptInvite': { data: {} } });

    await userEvent.type(await screen.findByLabelText('Passwort'), 'Neues!Passwort22');
    await userEvent.type(screen.getByLabelText('Passwort wiederholen'), 'Neues!Passwort22');
    await userEvent.click(screen.getByRole('button', { name: 'Passwort setzen' }));

    await screen.findByRole('heading', { level: 1, name: 'Anmelden' });
    expect(auth.calls.find((c) => c.url === '/acceptInvite')?.data).toEqual({ code: 'ABCD-EFGH-JKMN-PQRS', password: 'Neues!Passwort22' });
  });
});
