import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import Root from '../Root';
import { fakeClient } from '../test/fakeHttp';

const ME = {
  account: { id: '11111111-1111-4111-8111-111111111111', status: 'active', mfa_required: false },
  permissions: [] as string[],
  session: { used_mfa: false, expires_at: '2026-11-17T12:00:00+00:00' }
};

const REVOKE = 'POST /api/me/revoke-sessions';

/** Meldet an und oeffnet "Mein Konto"; ohne besonderes Recht (permissions leer). */
async function setup(apiRoutes = {}) {
  const auth = fakeClient({
    'POST /refresh': { status: 401 },
    'POST /login': { data: { token: 'jwt-1', email: 'lehrer@example.test' } },
    'POST /logout': { data: {} }
  });
  const api = fakeClient({ 'GET /api/me': { data: ME }, ...apiRoutes });
  render(<Root authClient={auth.client} apiClient={api.client} />);
  await userEvent.type(await screen.findByLabelText('E-Mail oder Anmeldename'), 'lehrer@example.test');
  await userEvent.type(screen.getByLabelText('Passwort'), 'geheim123');
  await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));
  await screen.findByRole('heading', { level: 1, name: 'Mein Konto' });
  return { auth, api };
}

const open = () => userEvent.click(screen.getByRole('button', { name: 'Alle Sitzungen beenden …' }));
const confirm = async () => userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Alle Sitzungen beenden' }));

describe('Mein Konto: Alle Sitzungen beenden (Ticket #50)', () => {
  beforeEach(() => localStorage.clear());

  it('bietet die Aktion ohne besonderes Recht an und fragt vor dem Ausfuehren nach', async () => {
    const { api } = await setup();

    await open();

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('auch auf diesem Gerät');
    expect(dialog).toHaveTextContent('neu anmelden');
    expect(api.calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('Abbrechen im Dialog beendet nichts', async () => {
    const { api, auth } = await setup();
    await open();

    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Abbrechen' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.calls.some((c) => c.method === 'POST')).toBe(false);
    expect(auth.calls.some((c) => c.url === '/logout')).toBe(false);
  });

  it('beendet nach Bestaetigung per POST, meldet ab und zeigt auf der Login-Seite den Hinweis', async () => {
    const { api, auth } = await setup({ [REVOKE]: { data: { revoked: true } } });
    await open();

    await confirm();

    expect(await screen.findByRole('heading', { level: 1, name: 'Anmelden' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/^Alle Sitzungen wurden beendet\.$/);
    expect(api.calls.filter((c) => c.method === 'POST').map((c) => c.url)).toEqual(['/api/me/revoke-sessions']);
    expect(auth.calls.some((c) => c.method === 'POST' && c.url === '/logout')).toBe(true);
  });

  it('meldet bei 502 auth_unavailable ab und zeigt den Hinweis auf der Login-Seite (die Sitzungen sind gesperrt)', async () => {
    const { auth } = await setup({ [REVOKE]: { status: 502, data: { error: 'x', code: 'auth_unavailable' } } });
    await open();

    await confirm();

    expect(await screen.findByRole('heading', { level: 1, name: 'Anmelden' })).toBeInTheDocument();
    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('später erneut an');
    expect(notice).toHaveTextContent('Schule');
    expect(notice).not.toHaveTextContent('Alle Sitzungen wurden beendet.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(auth.calls.some((c) => c.method === 'POST' && c.url === '/logout')).toBe(true);
  });

  it('meldet sonstige Fehler allgemein', async () => {
    await setup({ [REVOKE]: { status: 500 } });
    await open();

    await confirm();

    expect(await screen.findByRole('alert')).toHaveTextContent('Die Sitzungen konnten nicht beendet werden');
  });

  it('der Hinweis erscheint nach erneuter Anmeldung und spaeterem Abmelden nicht mehr', async () => {
    await setup({ [REVOKE]: { data: { revoked: true } } });
    await open();
    await confirm();
    await screen.findByRole('status');

    await userEvent.type(screen.getByLabelText('E-Mail oder Anmeldename'), 'lehrer@example.test');
    await userEvent.type(screen.getByLabelText('Passwort'), 'geheim123');
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));
    await screen.findByRole('heading', { level: 1, name: 'Mein Konto' });
    await userEvent.click(screen.getByRole('button', { name: 'Abmelden' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Anmelden' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
