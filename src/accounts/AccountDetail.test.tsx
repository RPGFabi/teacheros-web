import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import AccountDetail from './AccountDetail';
import type { AccountAccess } from './access';
import { fakeClient } from '../test/fakeHttp';

const ID = '33333333-3333-4333-8333-333333333333';

const action = (key: string, name: string, over: Record<string, unknown> = {}) => ({
  role_id: 'r-' + key,
  role_key: key,
  role_name: name,
  action: 'assign',
  allowed: true,
  code: null,
  reason: null,
  ...over
});

/** Konto mit der Rolle Lehrkraft; Sekretariat ist vergebbar, Schuladmin gesperrt. */
const ACCESS: AccountAccess = {
  account: { id: ID, email: 'ziel@schule.test', login_name: 'ziel', status: 'active', mfa_required: true },
  roles: [{ id: 'r-lehrkraft', key: 'lehrkraft', name: 'Lehrkraft', protection: 'standard', requires_mfa: true }],
  permissions: [
    { key: 'accounts.view', name: 'Konten ansehen', group: 'Konten', effective: true, sources: [{ kind: 'role', role_id: 'r-lehrkraft', role_key: 'lehrkraft', role_name: 'Lehrkraft' }] },
    { key: 'accounts.invite', name: 'Konten einladen', group: 'Konten', effective: true, sources: [{ kind: 'individual' }] },
    {
      key: 'roles.assign',
      name: 'Rollen vergeben und entziehen',
      group: 'Rollen und Rechte',
      effective: false,
      sources: [{ kind: 'role', role_id: 'r-lehrkraft', role_key: 'lehrkraft', role_name: 'Lehrkraft' }, { kind: 'withdrawn' }]
    }
  ],
  role_actions: [
    action('schuladmin', 'Schuladmin', { allowed: false, code: 'permission_not_held', reason: 'Sie besitzen nicht alle Rechte dieser Rolle.' }),
    action('lehrkraft', 'Lehrkraft', { action: 'revoke' }),
    action('sekretariat', 'Sekretariat')
  ]
};

const path = `GET /api/accounts/${ID}/access`;
const mount = (routes: Parameters<typeof fakeClient>[0], props: Partial<Parameters<typeof AccountDetail>[0]> = {}) => {
  const fake = fakeClient({ [path]: { data: ACCESS }, ...routes });
  render(<AccountDetail apiClient={fake.client} accountId={ID} canAssign onBack={() => {}} {...props} />);
  return fake;
};

describe('Kontodetail: Lesesicht', () => {
  it('zeigt Konto, Rollen und effektive Rechte mit Herkunft', async () => {
    mount({});

    expect(await screen.findByRole('heading', { name: /ziel@schule.test/ })).toBeInTheDocument();
    const roles = screen.getByRole('region', { name: 'Rollen' });
    expect(within(roles).getByText('Lehrkraft')).toBeInTheDocument();

    const perms = screen.getByRole('region', { name: 'Effektive Rechte' });
    const view = within(within(perms).getByText('Konten ansehen').closest('tr')!);
    expect(view.getByText('Rolle Lehrkraft')).toBeInTheDocument();
    expect(within(within(perms).getByText('Konten einladen').closest('tr')!).getByText('Einzelrecht')).toBeInTheDocument();
  });

  it('kennzeichnet ein entzogenes Einzelrecht als nicht wirksam mit Herkunft entzogen', async () => {
    mount({});

    const row = within((await screen.findByText('Rollen vergeben und entziehen', { selector: 'td, th' })).closest('tr')!);
    expect(row.getByText('Entzogen')).toBeInTheDocument();
    expect(row.getByText('Rolle Lehrkraft')).toBeInTheDocument();
    expect(row.getByText('Gilt nicht')).toBeInTheDocument();
  });

  it('zeigt einen Hinweis ohne Rechte und bei Ladefehler eine Meldung mit erneutem Laden', async () => {
    let attempts = 0;
    mount({ [path]: () => (++attempts === 1 ? { status: 500 } : { data: { ...ACCESS, permissions: [], roles: [], role_actions: ACCESS.role_actions.map((a) => ({ ...a, action: 'assign' as const })) } }) });

    expect(await screen.findByRole('alert')).toHaveTextContent('Das Konto konnte nicht geladen werden');
    await userEvent.click(screen.getByRole('button', { name: 'Erneut laden' }));

    expect(await screen.findByText('Dieses Konto hat keine Rechte.')).toBeInTheDocument();
    expect(screen.getByText('Dieses Konto hat keine Rolle.')).toBeInTheDocument();
  });

  it('meldet ein unbekanntes Konto verstaendlich', async () => {
    mount({ [path]: { status: 404, data: { error: 'x', code: 'account_not_found' } } });

    expect(await screen.findByRole('alert')).toHaveTextContent('Dieses Konto gibt es nicht mehr');
  });
});

describe('Kontodetail: Rollen vergeben und entziehen', () => {
  it('vergibt eine Rolle einzeln und zeigt danach die Antwort der API', async () => {
    const after: AccountAccess = {
      ...ACCESS,
      roles: [...ACCESS.roles, { id: 'r-sekretariat', key: 'sekretariat', name: 'Sekretariat', protection: 'standard', requires_mfa: true }],
      role_actions: ACCESS.role_actions.map((a) => (a.role_key === 'sekretariat' ? { ...a, action: 'revoke' as const } : a))
    };
    const { calls } = mount({ [`POST /api/accounts/${ID}/roles`]: { data: after } });
    await screen.findByRole('region', { name: 'Rollen' });

    await userEvent.click(screen.getByRole('button', { name: 'Rolle hinzufügen: Sekretariat' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Rolle Sekretariat vergeben');
    expect(calls.find((c) => c.method === 'POST')?.data).toEqual({ role_id: 'r-sekretariat' });
    expect(within(screen.getByRole('region', { name: 'Rollen' })).getByRole('button', { name: 'Rolle entziehen: Sekretariat' })).toBeInTheDocument();
  });

  it('entzieht eine Rolle einzeln', async () => {
    const after: AccountAccess = { ...ACCESS, roles: [], permissions: [], role_actions: ACCESS.role_actions.map((a) => ({ ...a, action: 'assign' as const })) };
    const { calls } = mount({ [`POST /api/accounts/${ID}/roles/r-lehrkraft/revoke`]: { data: after } });
    await screen.findByRole('region', { name: 'Rollen' });

    await userEvent.click(screen.getByRole('button', { name: 'Rolle entziehen: Lehrkraft' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Rolle Lehrkraft entzogen');
    expect(calls.some((c) => c.method === 'POST' && c.url === `/api/accounts/${ID}/roles/r-lehrkraft/revoke`)).toBe(true);
    expect(screen.getByText('Dieses Konto hat keine Rolle.')).toBeInTheDocument();
  });

  it('laesst nicht erlaubte Aktionen sichtbar, aber deaktiviert, mit Begruendung', async () => {
    mount({});

    const button = await screen.findByRole('button', { name: 'Rolle hinzufügen: Schuladmin' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('Sie besitzen nicht alle Rechte dieser Rolle.');
    expect(screen.getByText('Sie besitzen nicht alle Rechte dieser Rolle.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Rolle hinzufügen: Sekretariat' })).toBeEnabled();
  });

  it('sperrt ohne roles.assign alle Aktionen mit Begruendung, auch wenn die Rolle sonst erlaubt waere', async () => {
    mount({}, { canAssign: false });

    const button = await screen.findByRole('button', { name: 'Rolle hinzufügen: Sekretariat' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(/Rollen vergeben und entziehen/);
    expect(screen.getByRole('button', { name: 'Rolle entziehen: Lehrkraft' })).toBeDisabled();
  });

  it.each([
    ['self_escalation', 403, 'Sie können sich selbst keine Rolle geben'],
    ['permission_not_held', 403, 'Sie besitzen nicht alle Rechte dieser Rolle'],
    ['student_role_exclusive', 409, 'Schüler/in'],
    ['admin_overrides_forbidden', 409, 'Einzelrechte'],
    ['forbidden', 403, 'Dafür fehlt Ihnen die Berechtigung']
  ])('uebersetzt den Fehlercode %s in einen Text und laedt die Sicht neu', async (code, status, text) => {
    const { calls } = mount({ [`POST /api/accounts/${ID}/roles`]: { status, data: { error: 'x', code } } });
    await screen.findByRole('region', { name: 'Rollen' });

    await userEvent.click(screen.getByRole('button', { name: 'Rolle hinzufügen: Sekretariat' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(calls.filter((c) => c.method === 'GET' && c.url.endsWith('/access'))).toHaveLength(2);
  });

  it('sperrt Schuladmin entziehen beim letzten aktiven Admin mit der Begruendung der API', async () => {
    const reason = 'Das ist der letzte aktive Schuladmin. Ernennen Sie zuerst einen weiteren Schuladmin, der sich schon angemeldet hat.';
    const lastAdmin: AccountAccess = {
      ...ACCESS,
      roles: [{ id: 'r-schuladmin', key: 'schuladmin', name: 'Schuladmin', protection: 'wildcard', requires_mfa: true }],
      role_actions: [action('schuladmin', 'Schuladmin', { action: 'revoke', allowed: false, code: 'last_admin', reason }), action('sekretariat', 'Sekretariat')]
    };
    mount({ [path]: { data: lastAdmin } });

    const button = await screen.findByRole('button', { name: 'Rolle entziehen: Schuladmin' });

    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(reason);
    expect(screen.getByText(reason)).toBeVisible();
  });

  it('meldet last_admin beim Entziehen verstaendlich (etwa wenn ein anderer Admin schneller war) und laedt neu', async () => {
    const { calls } = mount({ [`POST /api/accounts/${ID}/roles/r-lehrkraft/revoke`]: { status: 409, data: { error: 'x', code: 'last_admin' } } });
    await screen.findByRole('region', { name: 'Rollen' });

    await userEvent.click(screen.getByRole('button', { name: 'Rolle entziehen: Lehrkraft' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('letzte aktive Schuladmin');
    expect(calls.filter((c) => c.method === 'GET' && c.url.endsWith('/access'))).toHaveLength(2);
  });

  it('ruft den Zurueck-Handler auf', async () => {
    let back = 0;
    mount({}, { onBack: () => back++ });

    await userEvent.click(await screen.findByRole('button', { name: 'Zurück zur Kontenliste' }));

    expect(back).toBe(1);
  });
});
