import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import RolesPage from './RolesPage';
import { fakeClient, type FakeCall } from '../test/fakeHttp';

const CATALOG = [
  { key: 'accounts.view', name: 'Konten ansehen', group: 'Konten' },
  { key: 'accounts.invite', name: 'Konten einladen', group: 'Konten' },
  { key: 'roles.manage', name: 'Rollen verwalten', group: 'Rollen und Rechte' },
  { key: 'roles.assign', name: 'Rollen vergeben und entziehen', group: 'Rollen und Rechte' }
];
const ALL = CATALOG.map((c) => c.key);

const role = (over: Record<string, unknown>) => ({
  id: 'r-' + over.key,
  description: null,
  permissions: [],
  all_permissions: false,
  requires_mfa: false,
  protection: 'standard',
  account_count: 0,
  ...over
});

const baseRoles = () => [
  role({ key: 'schuladmin', name: 'Schuladmin', permissions: ALL, all_permissions: true, requires_mfa: true, protection: 'wildcard', account_count: 2 }),
  role({ key: 'schueler', name: 'Schüler/in', protection: 'protected', account_count: 120 }),
  role({ key: 'lehrkraft', name: 'Lehrkraft', permissions: ['accounts.view'], requires_mfa: true, account_count: 14 }),
  role({ key: 'r_ab12', name: 'Vertretungsplan', description: 'Eigene Rolle.', permissions: ['accounts.view', 'roles.assign'], requires_mfa: true, protection: 'custom' }),
  role({ key: 'r_cd34', name: 'Fachschaft', protection: 'custom', account_count: 3 })
];

/** Fake-API mit veraenderlicher Rollenliste; Schreibwege lassen sich pro Test ueberschreiben. */
function setup(extra: Record<string, Parameters<typeof fakeClient>[0][string]> = {}, props: { canManage?: boolean; held?: string[] } = {}) {
  let roles = baseRoles();
  const { client, calls } = fakeClient({
    'GET /api/roles': () => ({ data: { roles } }),
    'GET /api/permissions': { data: { permissions: CATALOG } },
    'POST /api/roles': (call: FakeCall) => {
      const body = call.data as Record<string, unknown>;
      const created = role({ key: 'r_new1', ...body, protection: 'custom' });
      roles = [...roles, created];
      return { status: 201, data: { role: created } };
    },
    'POST /api/roles/r-r_ab12/update': (call: FakeCall) => {
      roles = roles.map((r) => (r.id === 'r-r_ab12' ? { ...r, ...(call.data as object) } : r));
      return { data: { role: roles.find((r) => r.id === 'r-r_ab12') } };
    },
    'POST /api/roles/r-lehrkraft/update': (call: FakeCall) => {
      roles = roles.map((r) => (r.id === 'r-lehrkraft' ? { ...r, ...(call.data as object) } : r));
      return { data: { role: roles.find((r) => r.id === 'r-lehrkraft') } };
    },
    'POST /api/roles/r-r_ab12/delete': () => {
      roles = roles.filter((r) => r.id !== 'r-r_ab12');
      return { data: { deleted: true } };
    },
    ...extra
  });
  render(<RolesPage apiClient={client} canManage={props.canManage ?? true} heldPermissions={props.held ?? ALL} />);
  return { calls, writes: () => calls.filter((c) => c.method !== 'GET') };
}

const rowOf = async (name: string) => (await screen.findByRole('rowheader', { name: new RegExp(name) })).closest('tr')!;
const form = () => screen.getByRole('form', { name: /Rolle/ });

describe('Rollen: anlegen', () => {
  it('legt eine Rolle mit Name, Beschreibung, gruppierten Rechten und MFA (Standard an) an', async () => {
    const { writes } = setup();
    await rowOf('Lehrkraft');

    await userEvent.click(screen.getByRole('button', { name: 'Rolle anlegen' }));

    const f = form();
    expect(within(f).getByRole('group', { name: 'Konten' })).toBeInTheDocument();
    expect(within(f).getByRole('group', { name: 'Rollen und Rechte' })).toBeInTheDocument();
    expect(within(f).getByRole('checkbox', { name: 'Erfordert MFA' })).toBeChecked();
    await userEvent.type(within(f).getByLabelText('Name'), '  Medienbeauftragte ');
    await userEvent.type(within(f).getByLabelText('Beschreibung'), 'Verwaltet Geräte');
    await userEvent.click(within(f).getByRole('checkbox', { name: 'Konten einladen' }));
    await userEvent.click(within(f).getByRole('button', { name: 'Anlegen' }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatchObject({
      method: 'POST',
      url: '/api/roles',
      data: { name: 'Medienbeauftragte', description: 'Verwaltet Geräte', permissions: ['accounts.invite'], requires_mfa: true }
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Rolle „Medienbeauftragte“ angelegt.');
    expect(await rowOf('Medienbeauftragte')).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('sendet requires_mfa false, wenn das Merkmal abgewaehlt wird', async () => {
    const { writes } = setup();
    await rowOf('Lehrkraft');
    await userEvent.click(screen.getByRole('button', { name: 'Rolle anlegen' }));

    await userEvent.type(within(form()).getByLabelText('Name'), 'Ohne MFA');
    await userEvent.click(within(form()).getByRole('checkbox', { name: 'Erfordert MFA' }));
    await userEvent.click(within(form()).getByRole('button', { name: 'Anlegen' }));

    await waitFor(() => expect(writes()[0]?.data).toMatchObject({ requires_mfa: false }));
  });

  it('verlangt einen Namen: ohne Name ist Anlegen deaktiviert', async () => {
    setup();
    await rowOf('Lehrkraft');
    await userEvent.click(screen.getByRole('button', { name: 'Rolle anlegen' }));

    expect(within(form()).getByRole('button', { name: 'Anlegen' })).toBeDisabled();
  });

  it('deaktiviert Rechte, die man selbst nicht besitzt, mit Begruendung', async () => {
    setup({}, { held: ['accounts.view', 'roles.manage'] });
    await rowOf('Lehrkraft');
    await userEvent.click(screen.getByRole('button', { name: 'Rolle anlegen' }));

    const invite = within(form()).getByRole('checkbox', { name: /Konten einladen/ });
    expect(invite).toBeDisabled();
    expect(invite).toHaveAccessibleDescription(/Sie besitzen dieses Recht nicht/);
    expect(within(form()).getByRole('checkbox', { name: /Konten ansehen/ })).toBeEnabled();
  });

  it('bricht ab und schliesst das Formular ohne Anfrage', async () => {
    const { writes } = setup();
    await rowOf('Lehrkraft');
    await userEvent.click(screen.getByRole('button', { name: 'Rolle anlegen' }));

    await userEvent.click(within(form()).getByRole('button', { name: 'Abbrechen' }));

    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  });

  it('zeigt Fehler der API verstaendlich und laesst das Formular offen', async () => {
    setup({ 'POST /api/roles': { status: 403, data: { error: 'x', code: 'permission_not_held' } } });
    await rowOf('Lehrkraft');
    await userEvent.click(screen.getByRole('button', { name: 'Rolle anlegen' }));
    await userEvent.type(within(form()).getByLabelText('Name'), 'Neu');

    await userEvent.click(within(form()).getByRole('button', { name: 'Anlegen' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('nur Rechte vergeben, die Sie selbst besitzen');
    expect(form()).toBeInTheDocument();
    expect(within(form()).getByLabelText('Name')).toHaveValue('Neu');
  });
});

describe('Rollen: bearbeiten', () => {
  it('fuellt das Formular mit der Rolle vor und speichert die Aenderungen per POST', async () => {
    const { writes } = setup();
    await rowOf('Vertretungsplan');

    await userEvent.click(screen.getByRole('button', { name: 'Bearbeiten: Vertretungsplan' }));

    const f = form();
    expect(within(f).getByLabelText('Name')).toHaveValue('Vertretungsplan');
    expect(within(f).getByLabelText('Beschreibung')).toHaveValue('Eigene Rolle.');
    expect(within(f).getByRole('checkbox', { name: 'Konten ansehen' })).toBeChecked();
    expect(within(f).getByRole('checkbox', { name: 'Konten einladen' })).not.toBeChecked();
    expect(within(f).getByRole('checkbox', { name: 'Erfordert MFA' })).toBeChecked();

    await userEvent.clear(within(f).getByLabelText('Name'));
    await userEvent.type(within(f).getByLabelText('Name'), 'Vertretung');
    await userEvent.click(within(f).getByRole('checkbox', { name: 'Rollen vergeben und entziehen' }));
    await userEvent.click(within(f).getByRole('checkbox', { name: 'Konten einladen' }));
    await userEvent.click(within(f).getByRole('checkbox', { name: 'Erfordert MFA' }));
    await userEvent.click(within(f).getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatchObject({
      method: 'POST',
      url: '/api/roles/r-r_ab12/update',
      data: { name: 'Vertretung', description: 'Eigene Rolle.', permissions: ['accounts.view', 'accounts.invite'], requires_mfa: false }
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Rolle „Vertretung“ gespeichert.');
    expect(await rowOf('Vertretung')).toBeInTheDocument();
  });

  it('Standardrolle: Rechte aenderbar, MFA-Merkmal fest (deaktiviert, mit Begruendung, nicht gesendet)', async () => {
    const { writes } = setup();
    await rowOf('Lehrkraft');

    await userEvent.click(screen.getByRole('button', { name: 'Bearbeiten: Lehrkraft' }));

    const mfa = within(form()).getByRole('checkbox', { name: 'Erfordert MFA' });
    expect(mfa).toBeChecked();
    expect(mfa).toBeDisabled();
    expect(mfa).toHaveAccessibleDescription(/bei Standardrollen fest/i);
    await userEvent.click(within(form()).getByRole('checkbox', { name: 'Konten einladen' }));
    await userEvent.click(within(form()).getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0].data).toEqual({ name: 'Lehrkraft', description: null, permissions: ['accounts.view', 'accounts.invite'] });
  });

  it.each([
    ['Schuladmin', 'Schuladmin'],
    ['Schüler/in', 'Schüler/in']
  ])('%s ist geschuetzt: Bearbeiten sichtbar, aber deaktiviert mit Begruendung', async (name) => {
    setup();
    await rowOf(name);

    const button = screen.getByRole('button', { name: `Bearbeiten: ${name}` });

    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(/geschützt/);
  });

  it('erlaubt, ein Recht abzuwaehlen, das man selbst nicht besitzt, aber nicht, es neu zu setzen', async () => {
    setup({}, { held: ['accounts.view', 'roles.manage'] });
    await rowOf('Vertretungsplan');
    await userEvent.click(screen.getByRole('button', { name: 'Bearbeiten: Vertretungsplan' }));

    // roles.assign steckt schon in der Rolle: abwaehlbar. accounts.invite fehlt der Rolle und dem Konto: gesperrt.
    expect(within(form()).getByRole('checkbox', { name: /Rollen vergeben und entziehen/ })).toBeEnabled();
    expect(within(form()).getByRole('checkbox', { name: /Konten einladen/ })).toBeDisabled();
  });

  it('zeigt „Eigene Rolle nicht erweiterbar“ bei self_escalation', async () => {
    setup({ 'POST /api/roles/r-r_ab12/update': { status: 403, data: { error: 'x', code: 'self_escalation' } } });
    await rowOf('Vertretungsplan');
    await userEvent.click(screen.getByRole('button', { name: 'Bearbeiten: Vertretungsplan' }));

    await userEvent.click(within(form()).getByRole('checkbox', { name: 'Konten einladen' }));
    await userEvent.click(within(form()).getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Rolle, die Sie selbst innehaben');
  });
});

describe('Rollen: loeschen', () => {
  it('loescht eine unbenutzte eigene Rolle nach Bestaetigung', async () => {
    const { writes } = setup();
    await rowOf('Vertretungsplan');

    await userEvent.click(screen.getByRole('button', { name: 'Löschen: Vertretungsplan' }));
    const dialog = await screen.findByRole('dialog');
    expect(writes()).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Löschen' }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatchObject({ method: 'POST', url: '/api/roles/r-r_ab12/delete' });
    expect(await screen.findByRole('status')).toHaveTextContent('Rolle „Vertretungsplan“ gelöscht.');
    await waitFor(() => expect(screen.queryByRole('rowheader', { name: /Vertretungsplan/ })).not.toBeInTheDocument());
  });

  it('Abbrechen im Dialog loescht nichts', async () => {
    const { writes } = setup();
    await rowOf('Vertretungsplan');
    await userEvent.click(screen.getByRole('button', { name: 'Löschen: Vertretungsplan' }));

    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Abbrechen' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  });

  it('Standardrollen sind nicht loeschbar: Schaltflaeche sichtbar, deaktiviert, mit Begruendung', async () => {
    setup();
    await rowOf('Lehrkraft');

    for (const name of ['Schuladmin', 'Schüler/in', 'Lehrkraft']) {
      const button = screen.getByRole('button', { name: `Löschen: ${name}` });
      expect(button).toBeDisabled();
      expect(button).toHaveAccessibleDescription(/Standardrollen lassen sich nicht löschen/);
    }
  });

  it('eine noch zugewiesene Rolle ist nicht loeschbar, die Begruendung nennt die Zahl der Konten', async () => {
    setup();
    await rowOf('Fachschaft');

    const button = screen.getByRole('button', { name: 'Löschen: Fachschaft' });

    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(/noch 3 Konten zugewiesen/);
  });

  it('zeigt role_in_use der API verstaendlich, wenn die Rolle inzwischen vergeben wurde', async () => {
    setup({ 'POST /api/roles/r-r_ab12/delete': { status: 409, data: { error: 'x', code: 'role_in_use' } } });
    await rowOf('Vertretungsplan');
    await userEvent.click(screen.getByRole('button', { name: 'Löschen: Vertretungsplan' }));

    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Löschen' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('noch Konten zugewiesen');
  });
});

describe('Rollen: ohne Recht roles.manage', () => {
  it('zeigt alle Schreibaktionen, aber deaktiviert, mit einer Begruendung', async () => {
    setup({}, { canManage: false });
    await rowOf('Vertretungsplan');

    const buttons = [
      screen.getByRole('button', { name: 'Rolle anlegen' }),
      screen.getByRole('button', { name: 'Bearbeiten: Vertretungsplan' }),
      screen.getByRole('button', { name: 'Löschen: Vertretungsplan' })
    ];
    for (const button of buttons) {
      expect(button).toBeDisabled();
      expect(button).toHaveAccessibleDescription(/Recht „Rollen verwalten“/);
    }
  });
});
