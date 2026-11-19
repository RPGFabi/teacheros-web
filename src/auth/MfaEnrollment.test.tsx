import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import Root from '../Root';
import App from '../App';
import { fakeClient } from '../test/fakeHttp';
import { ENROLLED_NOTICE } from './MfaEnrollmentPage';

const ME = (enrollment: boolean, usedMfa = false) => ({
  account: { id: '11111111-1111-4111-8111-111111111111', status: 'active', mfa_required: true },
  permissions: ['accounts.view'],
  session: { used_mfa: usedMfa, expires_at: '2026-11-17T12:00:00+00:00', mfa_enrollment_required: enrollment }
});

const SETUP = {
  secret: 'ABCDEFGHIJKLMNOP',
  secret_readable: 'ABCD EFGH IJKL MNOP',
  provisioning_uri: 'otpauth://totp/Schule:lehrer%40example.test?secret=ABCDEFGHIJKLMNOP',
  qr_code_data_uri: 'data:image/png;base64,xx',
  setup_token: 'setup-1',
  expires_in: 600
};

async function login() {
  await userEvent.type(await screen.findByLabelText('E-Mail oder Anmeldename'), 'lehrer@example.test');
  await userEvent.type(screen.getByLabelText('Passwort'), 'geheim123');
  await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));
}

describe('MFA-Pflicht: Einrichtung (Ticket #15)', () => {
  beforeEach(() => localStorage.clear());

  it('fuehrt eine Lehrkraft ohne TOTP durch die Einrichtung und danach zur erneuten Anmeldung', async () => {
    const auth = fakeClient({
      'POST /refresh': { status: 401 },
      'POST /login': { data: { token: 'jwt-1', email: 'lehrer@example.test' } },
      'POST /mfa/setup': { data: SETUP },
      'POST /mfa/setup/confirm': (call) =>
        (call.data as { code?: string }).code === '123456'
          ? { data: { enabled: true, reauthentication_required: true, recovery_codes: ['aaaa-bbbb', 'cccc-dddd'] } }
          : { status: 401, data: { code: 'invalid_mfa_code' } },
      'POST /logout': { data: {} }
    });
    const api = fakeClient({ 'GET /api/me': { data: ME(true) } });
    render(<Root authClient={auth.client} apiClient={api.client} />);

    await login();

    expect(await screen.findByRole('heading', { level: 1, name: 'Zweiten Faktor einrichten' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Hauptnavigation' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Einrichtung starten' }));
    expect(await screen.findByText('ABCD EFGH IJKL MNOP')).toBeInTheDocument();
    expect(auth.calls.find((c) => c.url === '/mfa/setup')?.authorization).toBe('Bearer jwt-1');

    await userEvent.type(screen.getByLabelText('Code aus der App'), '000000');
    await userEvent.click(screen.getByRole('button', { name: 'Bestätigen' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Der Code ist ungültig');
    // Ein falscher Code loest keinen Token-Refresh und keine Wiederholung aus.
    expect(auth.calls.filter((c) => c.url === '/mfa/setup/confirm')).toHaveLength(1);

    await userEvent.clear(screen.getByLabelText('Code aus der App'));
    await userEvent.type(screen.getByLabelText('Code aus der App'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Bestätigen' }));

    const codes = await screen.findByRole('list', { name: 'Wiederherstellungscodes' });
    expect(within(codes).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['aaaa-bbbb', 'cccc-dddd']);
    expect(auth.calls.filter((c) => c.url === '/mfa/setup/confirm')[1].data).toEqual({ setup_token: 'setup-1', code: '123456' });

    await userEvent.click(screen.getByRole('button', { name: 'Codes gesichert, neu anmelden' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Anmelden' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(ENROLLED_NOTICE);
  });

  it('zeigt mit MFA angemeldet die Portale statt der Einrichtung', async () => {
    render(<App apiClient={fakeClient({ 'GET /api/me': { data: ME(false, true) } }).client} />);
    expect(await screen.findByRole('navigation', { name: 'Hauptnavigation' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Zweiten Faktor einrichten' })).not.toBeInTheDocument();
  });

  it('wechselt zur Einrichtung, wenn eine fachliche Route mitten in der Sitzung 403 mfa_enrollment_required meldet', async () => {
    const api = fakeClient({
      'GET /api/me': { data: { ...ME(false), account: { ...ME(false).account, mfa_required: false } } },
      'GET /api/accounts': { status: 403, data: { error: 'MFA enrollment required', code: 'mfa_enrollment_required' } }
    });
    render(<App apiClient={api.client} />);

    await userEvent.click(await screen.findByRole('link', { name: 'Konten' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Zweiten Faktor einrichten' })).toBeInTheDocument();
  });

  it('bittet bei schon eingerichtetem TOTP nur um erneute Anmeldung', async () => {
    const auth = fakeClient({ 'POST /mfa/setup': { status: 409, data: { code: 'mfa_already_enabled' } } });
    let notice = '';
    render(<App apiClient={fakeClient({ 'GET /api/me': { data: ME(true) } }).client} authClient={auth.client} onReauthenticate={(n) => (notice = n)} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Einrichtung starten' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Neu anmelden' }));

    expect(notice).toContain('erneut an');
  });
});
