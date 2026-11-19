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
  account: { id: ID, email: 'ziel@schule.test', login_name: 'ziel', status: 'active', inactive_since: null, inactive_reason: null, mfa_required: true },
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
  ],
  permission_actions: [],
  account_actions: [{ action: 'deactivate', allowed: true, code: null, reason: null }]
};

const path = `GET /api/accounts/${ID}/access`;
const mount = (routes: Parameters<typeof fakeClient>[0], props: Partial<Parameters<typeof AccountDetail>[0]> = {}) => {
  const fake = fakeClient({ [path]: { data: ACCESS }, ...routes });
  render(<AccountDetail apiClient={fake.client} accountId={ID} canAssign onBack={() => {}} {...props} />);
  return fake;
};

describe('Kontodetail: Lesesicht', () => {
  it('nennt das MFA-Merkmal einheitlich „Erfordert MFA“', async () => {
    mount({});

    expect(await screen.findByText(/Erfordert MFA: Ja/)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('Mehrfaktor');
  });

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

  it('blendet Rollen, Rechte und Einzelrechte aus, wenn die API sie dem Betrachter nicht liefert (nur accounts.deactivate)', async () => {
    const { account, account_actions } = ACCESS;
    mount({ [path]: { data: { account, account_actions } } });

    expect(await screen.findByRole('heading', { name: /ziel@schule.test/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Konto' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Rollen' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Effektive Rechte' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Einzelrechte' })).not.toBeInTheDocument();
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
    ['self_escalation', 403, 'Sie können sich selbst keine Rollen oder Einzelrechte'],
    ['permission_not_held', 403, 'Sie besitzen nicht alle dafür nötigen Rechte'],
    ['student_role_exclusive', 409, 'Schüler/in'],
    ['admin_overrides_forbidden', 409, 'Einzelrechte'],
    ['forbidden', 403, 'Dafür fehlt Ihnen das erforderliche Recht']
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

const permissionAction = (key: string, name: string, over: Record<string, unknown> = {}) => ({
  permission: key,
  name,
  group: 'Konten',
  action: 'grant',
  allowed: true,
  code: null,
  reason: null,
  ...over
});

/** Einzelrechte-Sicht zu ACCESS: Einladen gewaehrt (zuruecksetzen), Ansehen aus Rolle (entziehen), Rollen entzogen (zuruecksetzen), Verwalten gewaehrbar, Einzelrechte gesperrt. */
const PERMISSION_ACTIONS = [
  permissionAction('accounts.view', 'Konten ansehen', { action: 'withdraw' }),
  permissionAction('accounts.invite', 'Konten einladen', { action: 'clear' }),
  permissionAction('roles.manage', 'Rollen verwalten', { group: 'Rollen und Rechte' }),
  permissionAction('roles.assign', 'Rollen vergeben und entziehen', { group: 'Rollen und Rechte', action: 'clear' }),
  permissionAction('permissions.assign', 'Einzelrechte vergeben und entziehen', {
    group: 'Rollen und Rechte',
    allowed: false,
    code: 'permission_not_held',
    reason: 'Sie besitzen dieses Recht nicht.'
  })
];

describe('Kontodetail: Einzelrechte (Ticket #36)', () => {
  const GRANT = `POST /api/accounts/${ID}/permissions/grant`;
  const mountWith = (routes: Parameters<typeof fakeClient>[0] = {}, props: Partial<Parameters<typeof AccountDetail>[0]> = {}) =>
    mount({ [path]: { data: { ...ACCESS, permission_actions: PERMISSION_ACTIONS } }, ...routes }, { canAssignPermissions: true, ...props });

  it('zeigt einen Abschnitt Einzelrechte mit Herkunft und der passenden Aktion je Recht', async () => {
    mountWith();

    const section = await screen.findByRole('region', { name: 'Einzelrechte' });
    const row = (name: string) => within(within(section).getByText(name).closest('tr')!);
    expect(row('Konten einladen').getByText('Einzelrecht')).toBeInTheDocument();
    expect(row('Konten einladen').getByRole('button', { name: 'Einzelrecht zurücksetzen: Konten einladen' })).toBeEnabled();
    expect(row('Konten ansehen').getByRole('button', { name: 'Einzelrecht entziehen: Konten ansehen' })).toBeEnabled();
    expect(row('Rollen vergeben und entziehen').getByText('Entzogen')).toBeInTheDocument();
    expect(row('Rollen verwalten').getByRole('button', { name: 'Einzelrecht gewähren: Rollen verwalten' })).toBeEnabled();
  });

  it('laesst nicht erlaubte Aktionen sichtbar, aber deaktiviert, mit Begruendung', async () => {
    mountWith();

    const button = await screen.findByRole('button', { name: 'Einzelrecht gewähren: Einzelrechte vergeben und entziehen' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('Sie besitzen dieses Recht nicht.');
    expect(screen.getByText('Sie besitzen dieses Recht nicht.')).toBeVisible();
  });

  it('sperrt ohne permissions.assign alle Aktionen mit Begruendung', async () => {
    mountWith({}, { canAssignPermissions: false });

    const button = await screen.findByRole('button', { name: 'Einzelrecht gewähren: Rollen verwalten' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(/Einzelrechte vergeben und entziehen/);
    expect(screen.getByRole('button', { name: 'Einzelrecht entziehen: Konten ansehen' })).toBeDisabled();
  });

  it('gewaehrt ein Einzelrecht per POST und zeigt danach die Antwort der API', async () => {
    const after = {
      ...ACCESS,
      permission_actions: PERMISSION_ACTIONS.map((a) => (a.permission === 'roles.manage' ? { ...a, action: 'clear' } : a)),
      permissions: [...ACCESS.permissions, { key: 'roles.manage', name: 'Rollen verwalten', group: 'Rollen und Rechte', effective: true, sources: [{ kind: 'individual' }] }]
    };
    const { calls } = mountWith({ [GRANT]: { data: after } });
    await screen.findByRole('region', { name: 'Einzelrechte' });

    await userEvent.click(screen.getByRole('button', { name: 'Einzelrecht gewähren: Rollen verwalten' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Einzelrecht „Rollen verwalten“ gewährt');
    expect(calls.find((c) => c.method === 'POST')?.data).toEqual({ permission: 'roles.manage' });
    expect(screen.getByRole('button', { name: 'Einzelrecht zurücksetzen: Rollen verwalten' })).toBeInTheDocument();
  });

  it('entzieht und setzt zurueck ueber die eigenen Endpunkte', async () => {
    const ok = { data: { ...ACCESS, permission_actions: PERMISSION_ACTIONS } };
    const { calls } = mountWith({ [`POST /api/accounts/${ID}/permissions/withdraw`]: ok, [`POST /api/accounts/${ID}/permissions/clear`]: ok });
    await screen.findByRole('region', { name: 'Einzelrechte' });

    await userEvent.click(screen.getByRole('button', { name: 'Einzelrecht entziehen: Konten ansehen' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Einzelrecht „Konten ansehen“ entzogen');
    await userEvent.click(screen.getByRole('button', { name: 'Einzelrecht zurücksetzen: Konten einladen' }));
    expect(await screen.findByText('Einzelrecht „Konten einladen“ zurückgesetzt.')).toBeInTheDocument();

    expect(calls.filter((c) => c.method === 'POST').map((c) => [c.url, c.data])).toEqual([
      [`/api/accounts/${ID}/permissions/withdraw`, { permission: 'accounts.view' }],
      [`/api/accounts/${ID}/permissions/clear`, { permission: 'accounts.invite' }]
    ]);
  });

  it.each([
    ['self_escalation', 403, 'Sie können sich selbst keine Rollen oder Einzelrechte'],
    ['permission_not_held', 403, 'Sie besitzen nicht alle dafür nötigen Rechte'],
    ['student_role_exclusive', 409, 'Schüler/in'],
    ['admin_overrides_forbidden', 409, 'Schuladmin'],
    ['forbidden', 403, 'Dafür fehlt Ihnen das erforderliche Recht']
  ])('uebersetzt den Fehlercode %s in einen Text und laedt die Sicht neu', async (code, status, text) => {
    const { calls } = mountWith({ [GRANT]: { status, data: { error: 'x', code } } });
    await screen.findByRole('region', { name: 'Einzelrechte' });

    await userEvent.click(screen.getByRole('button', { name: 'Einzelrecht gewähren: Rollen verwalten' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(calls.filter((c) => c.method === 'GET' && c.url.endsWith('/access'))).toHaveLength(2);
  });
});

describe('Kontodetail: Konto deaktivieren (Ticket #41)', () => {
  const DEACTIVATE = `POST /api/accounts/${ID}/deactivate`;
  const INACTIVE: AccountAccess = {
    ...ACCESS,
    account: { ...ACCESS.account, status: 'inactive', inactive_since: '2026-11-18T09:00:00+00:00', inactive_reason: 'admin_locked' },
    account_actions: [{ action: 'deactivate', allowed: false, code: 'account_not_active', reason: 'Nur aktive Konten lassen sich deaktivieren.' }]
  };

  it('zeigt „Deaktivieren …“ aktiv, wenn die API die Aktion erlaubt, und fragt vor dem Ausfuehren nach', async () => {
    const { calls } = mount({ [DEACTIVATE]: { data: INACTIVE } });

    const button = await screen.findByRole('button', { name: 'Deaktivieren …' });
    expect(button).toBeEnabled();
    await userEvent.click(button);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('ziel@schule.test');
    expect(dialog).toHaveTextContent('Sitzungen enden sofort');
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('Abbrechen im Dialog deaktiviert nichts', async () => {
    const { calls } = mount({});
    await userEvent.click(await screen.findByRole('button', { name: 'Deaktivieren …' }));

    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Abbrechen' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('deaktiviert nach Bestaetigung und zeigt danach Status mit Datum und die Antwort der API', async () => {
    const { calls } = mount({ [DEACTIVATE]: { data: INACTIVE } });
    await userEvent.click(await screen.findByRole('button', { name: 'Deaktivieren …' }));

    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Deaktivieren' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Konto deaktiviert');
    expect(calls.filter((c) => c.method === 'POST').map((c) => c.url)).toEqual([`/api/accounts/${ID}/deactivate`]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText(/Deaktiviert seit 18\.11\.2026/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deaktivieren …' })).toBeDisabled();
  });

  it('laesst die Aktion sichtbar, aber deaktiviert, mit der Begruendung der API', async () => {
    const reason = 'Sie können sich nicht selbst deaktivieren.';
    mount({ [path]: { data: { ...ACCESS, account_actions: [{ action: 'deactivate', allowed: false, code: 'self_deactivation', reason }] } } });

    const button = await screen.findByRole('button', { name: 'Deaktivieren …' });

    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(reason);
    expect(screen.getByText(reason)).toBeVisible();
  });

  it.each([
    ['self_deactivation', 409, 'nicht selbst deaktivieren'],
    ['account_not_active', 409, 'Nur aktive Konten'],
    ['last_admin', 409, 'letzte aktive Schuladmin'],
    ['permission_not_held', 403, 'nicht alle Rechte dieses Kontos'],
    ['forbidden', 403, 'Dafür fehlt Ihnen das erforderliche Recht']
  ])('uebersetzt den Fehlercode %s in einen Text, schliesst den Dialog und laedt die Sicht neu', async (code, status, text) => {
    const { calls } = mount({ [DEACTIVATE]: { status, data: { error: 'x', code } } });
    await userEvent.click(await screen.findByRole('button', { name: 'Deaktivieren …' }));

    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Deaktivieren' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'GET' && c.url.endsWith('/access'))).toHaveLength(2);
  });

  it('meldet sonstige Fehler allgemein', async () => {
    mount({ [DEACTIVATE]: { status: 500 } });
    await userEvent.click(await screen.findByRole('button', { name: 'Deaktivieren …' }));

    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Deaktivieren' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Das Konto konnte nicht deaktiviert werden');
  });
});

describe('Kontodetail: Abgleich mit dem Anmeldedienst (Ticket #42)', () => {
  const DEACTIVATE = `POST /api/accounts/${ID}/deactivate`;
  const RESYNC = `POST /api/accounts/${ID}/resync-login`;
  const BLOCKED_DEACTIVATE = { action: 'deactivate', allowed: false, code: 'account_not_active', reason: 'Nur aktive Konten lassen sich deaktivieren.' } as const;
  const PENDING: AccountAccess = {
    ...ACCESS,
    account: { ...ACCESS.account, status: 'inactive', inactive_since: '2026-11-18T09:00:00+00:00', inactive_reason: 'admin_locked' },
    open_calls: [{ operation: 'disable_login', rejection_code: null }],
    account_actions: [BLOCKED_DEACTIVATE, { action: 'resync_login', allowed: true, code: null, reason: null }]
  };
  const SYNCED: AccountAccess = { ...PENDING, open_calls: [], account_actions: [BLOCKED_DEACTIVATE] };

  it('zeigt den Hinweis „Abgleich mit dem Anmeldedienst offen“ und den Knopf „Abgleich wiederholen“', async () => {
    mount({ [path]: { data: PENDING } });

    const section = await screen.findByRole('region', { name: 'Konto' });
    expect(within(section).getByText(/Abgleich mit dem Anmeldedienst offen/)).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Abgleich wiederholen' })).toBeEnabled();
  });

  it('nennt im offenen Abgleich in Worten der Deaktivierung, nicht der Sperre, was offen ist', async () => {
    mount({ [path]: { data: PENDING } });

    const section = await screen.findByRole('region', { name: 'Konto' });
    expect(section).toHaveTextContent('Das Konto ist hier deaktiviert');
    expect(section).toHaveTextContent('Dem Anmeldedienst ist die Deaktivierung aber noch nicht gemeldet');
    expect(section).not.toHaveTextContent(/gesperrt|Sperre/);
  });

  it('nennt bei fachlicher Ablehnung des Anmeldedienstes den Grund verstaendlich statt nur „Abgleich offen“', async () => {
    mount({ [path]: { data: { ...PENDING, open_calls: [{ operation: 'disable_login', rejection_code: 'user_not_found' }] } } });

    const section = await screen.findByRole('region', { name: 'Konto' });
    expect(within(section).getByText(/Der Anmeldedienst kennt dieses Konto nicht/)).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Abgleich wiederholen' })).toBeEnabled();
  });

  it('nennt bei einem unbekannten Ablehnungscode den Code allgemein', async () => {
    mount({ [path]: { data: { ...PENDING, open_calls: [{ operation: 'disable_login', rejection_code: 'seltsam' }] } } });

    expect(await screen.findByText(/Der Anmeldedienst hat den Abgleich abgelehnt \(seltsam\)/)).toBeInTheDocument();
  });

  it('nennt ohne Ablehnungscode (Dienst nicht erreichbar) keine Ablehnung', async () => {
    mount({ [path]: { data: PENDING } });

    await screen.findByRole('region', { name: 'Konto' });
    expect(screen.queryByText(/abgelehnt|kennt dieses Konto nicht/)).not.toBeInTheDocument();
  });

  it('zeigt weder Hinweis noch Knopf, wenn kein Abgleich offen ist', async () => {
    mount({ [path]: { data: SYNCED } });

    await screen.findByRole('region', { name: 'Konto' });
    expect(screen.queryByText(/Abgleich mit dem Anmeldedienst offen/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abgleich wiederholen' })).not.toBeInTheDocument();
  });

  it('wiederholt den Abgleich und zeigt danach die Sicht der API ohne Markierung', async () => {
    const { calls } = mount({ [path]: { data: PENDING }, [RESYNC]: { data: SYNCED } });

    await userEvent.click(await screen.findByRole('button', { name: 'Abgleich wiederholen' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Abgleich mit dem Anmeldedienst nachgeholt');
    expect(calls.filter((c) => c.method === 'POST').map((c) => c.url)).toEqual([`/api/accounts/${ID}/resync-login`]);
    expect(screen.queryByText(/Abgleich mit dem Anmeldedienst offen/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abgleich wiederholen' })).not.toBeInTheDocument();
  });

  it('meldet einen nicht erreichbaren Anmeldedienst (502) und laesst die Markierung stehen', async () => {
    mount({ [path]: { data: PENDING }, [RESYNC]: { status: 502, data: { error: 'x', code: 'auth_unavailable' } } });

    await userEvent.click(await screen.findByRole('button', { name: 'Abgleich wiederholen' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Der Anmeldedienst ist gerade nicht erreichbar. Der Abgleich bleibt offen');
    expect(screen.getByText(/Abgleich mit dem Anmeldedienst offen/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abgleich wiederholen' })).toBeEnabled();
  });

  it('uebersetzt eine fachliche Ablehnung und sonstige Fehler', async () => {
    mount({ [path]: { data: PENDING }, [RESYNC]: { status: 409, data: { error: 'x', code: 'sync_not_pending' } } });

    await userEvent.click(await screen.findByRole('button', { name: 'Abgleich wiederholen' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Es ist kein Abgleich mehr offen');
  });

  it('meldet sonstige Fehler allgemein', async () => {
    mount({ [path]: { data: PENDING }, [RESYNC]: { status: 500 } });

    await userEvent.click(await screen.findByRole('button', { name: 'Abgleich wiederholen' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Der Abgleich konnte nicht wiederholt werden');
  });

  it('laesst den Knopf ohne Recht sichtbar, aber gesperrt, mit der Begruendung der API', async () => {
    const reason = 'Dafür fehlt Ihnen das Recht, Konten zu deaktivieren.';
    mount({ [path]: { data: { ...PENDING, account_actions: [BLOCKED_DEACTIVATE, { action: 'resync_login', allowed: false, code: 'forbidden', reason }] } } });

    const button = await screen.findByRole('button', { name: 'Abgleich wiederholen' });

    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(reason);
  });

  it('nennt nach der Deaktivierung, dass der Abgleich noch offen ist', async () => {
    mount({ [DEACTIVATE]: { data: PENDING } });
    await userEvent.click(await screen.findByRole('button', { name: 'Deaktivieren …' }));

    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Deaktivieren' }));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Konto deaktiviert');
    expect(status).toHaveTextContent('Abgleich mit dem Anmeldedienst ist noch offen');
    expect(screen.getByRole('button', { name: 'Abgleich wiederholen' })).toBeEnabled();
  });

  it('nennt nach der Deaktivierung ohne Ausfall nur „Konto deaktiviert.“', async () => {
    mount({ [DEACTIVATE]: { data: SYNCED } });
    await userEvent.click(await screen.findByRole('button', { name: 'Deaktivieren …' }));

    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Deaktivieren' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/^Konto deaktiviert\.$/);
  });

  it('listet mehrere offene Aufrufe, jeden mit seinem eigenen Grund (Ticket #47)', async () => {
    mount({
      [path]: {
        data: {
          ...PENDING,
          open_calls: [
            { operation: 'disable_login', rejection_code: 'user_not_found' },
            { operation: 'revoke_sessions', rejection_code: null },
            { operation: 'reset_mfa', rejection_code: 'seltsam' }
          ]
        }
      }
    });

    const list = within(await screen.findByRole('region', { name: 'Konto' })).getByRole('list', { name: 'Offene Aufrufe' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Dem Anmeldedienst ist die Deaktivierung aber noch nicht gemeldet');
    expect(items[0]).toHaveTextContent('Der Anmeldedienst kennt dieses Konto nicht');
    expect(items[1]).toHaveTextContent('revoke_sessions');
    expect(items[1]).not.toHaveTextContent(/abgelehnt/);
    expect(items[2]).toHaveTextContent('Der Anmeldedienst hat den Abgleich abgelehnt (seltsam)');
  });

  it('zeigt „Abgleich wiederholen“ nur einmal, auch bei mehreren offenen Aufrufen', async () => {
    mount({ [path]: { data: { ...PENDING, open_calls: [{ operation: 'disable_login', rejection_code: null }, { operation: 'revoke_sessions', rejection_code: null }] } } });

    await screen.findByRole('region', { name: 'Konto' });
    expect(screen.getAllByRole('button', { name: 'Abgleich wiederholen' })).toHaveLength(1);
  });

  it('kennzeichnet den Abgleich auch in der Statuszeile', async () => {
    mount({ [path]: { data: PENDING } });

    expect(await screen.findByText(/Deaktiviert seit 18\.11\.2026 \(Abgleich offen\)/)).toBeInTheDocument();
  });
});

describe('Kontodetail: Konto reaktivieren (Ticket #43)', () => {
  const REACTIVATE = `POST /api/accounts/${ID}/reactivate`;
  const BLOCKED_DEACTIVATE = { action: 'deactivate', allowed: false, code: 'account_not_active', reason: 'Nur aktive Konten lassen sich deaktivieren.' } as const;
  const INACTIVE: AccountAccess = {
    ...ACCESS,
    account: { ...ACCESS.account, status: 'inactive', inactive_since: '2026-11-18T09:00:00+00:00', inactive_reason: 'admin_locked' },
    open_calls: [],
    account_actions: [BLOCKED_DEACTIVATE, { action: 'reactivate', allowed: true, code: null, reason: null }]
  };
  const ACTIVE_AGAIN: AccountAccess = { ...ACCESS, open_calls: [] };

  it('zeigt „Reaktivieren“ aktiv bei einem deaktivierten Konto, wenn die API die Aktion erlaubt', async () => {
    mount({ [path]: { data: INACTIVE } });

    const section = await screen.findByRole('region', { name: 'Konto' });
    expect(within(section).getByRole('button', { name: 'Reaktivieren' })).toBeEnabled();
  });

  it('zeigt keinen Knopf „Reaktivieren“, wenn die API die Aktion nicht nennt (aktives Konto)', async () => {
    mount({});

    await screen.findByRole('region', { name: 'Konto' });
    expect(screen.queryByRole('button', { name: 'Reaktivieren' })).not.toBeInTheDocument();
  });

  it('reaktiviert per POST und zeigt danach Status und die Antwort der API', async () => {
    const { calls } = mount({ [path]: { data: INACTIVE }, [REACTIVATE]: { data: ACTIVE_AGAIN } });

    await userEvent.click(await screen.findByRole('button', { name: 'Reaktivieren' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Konto reaktiviert');
    expect(calls.filter((c) => c.method === 'POST').map((c) => c.url)).toEqual([`/api/accounts/${ID}/reactivate`]);
    expect(screen.getByText(/Aktiv ·/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reaktivieren' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deaktivieren …' })).toBeEnabled();
  });

  it('laesst die Aktion sichtbar, aber gesperrt, mit der Begruendung der API', async () => {
    const reason = 'Sie besitzen nicht alle Rechte dieses Kontos und dürfen es deshalb nicht reaktivieren.';
    mount({
      [path]: { data: { ...INACTIVE, account_actions: [BLOCKED_DEACTIVATE, { action: 'reactivate', allowed: false, code: 'permission_not_held', reason }] } }
    });

    const button = await screen.findByRole('button', { name: 'Reaktivieren' });

    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(reason);
    expect(screen.getByText(reason)).toBeVisible();
  });

  it.each([
    ['self_deleted', 409, 'selbst gelöscht'],
    ['email_unconfirmed', 409, 'noch nicht bestätigt'],
    ['auth_unavailable', 502, 'Anmeldedienst ist gerade nicht erreichbar. Das Konto bleibt deaktiviert'],
    ['account_not_inactive', 409, 'Nur deaktivierte Konten'],
    ['self_reactivation', 409, 'nicht selbst reaktivieren'],
    ['permission_not_held', 403, 'dürfen es deshalb nicht reaktivieren'],
    ['forbidden', 403, 'Dafür fehlt Ihnen das erforderliche Recht']
  ])('uebersetzt den Fehlercode %s in einen Text und laedt die Sicht neu', async (code, status, text) => {
    const { calls } = mount({ [path]: { data: INACTIVE }, [REACTIVATE]: { status, data: { error: 'x', code } } });

    await userEvent.click(await screen.findByRole('button', { name: 'Reaktivieren' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(calls.filter((c) => c.method === 'GET' && c.url.endsWith('/access'))).toHaveLength(2);
    expect(screen.getByText(/Deaktiviert seit 18\.11\.2026/)).toBeInTheDocument();
  });

  it('meldet sonstige Fehler allgemein', async () => {
    mount({ [path]: { data: INACTIVE }, [REACTIVATE]: { status: 500 } });

    await userEvent.click(await screen.findByRole('button', { name: 'Reaktivieren' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Das Konto konnte nicht reaktiviert werden');
  });

  it('erklaert im Abschnitt Konto, dass alte Sitzungen nicht zurueckkommen', async () => {
    mount({ [path]: { data: INACTIVE } });

    const section = await screen.findByRole('region', { name: 'Konto' });
    expect(section).toHaveTextContent('Die Person muss sich danach neu anmelden');
  });
});
