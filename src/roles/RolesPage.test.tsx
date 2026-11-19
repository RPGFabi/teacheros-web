import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import RolesPage from './RolesPage';
import { fakeClient } from '../test/fakeHttp';
import { createBlock, role as baseRole } from '../test/roleFixtures';

const CATALOG = [
  { key: 'accounts.view', name: 'Konten ansehen', group: 'Konten' },
  { key: 'roles.manage', name: 'Rollen verwalten', group: 'Rollen und Rechte' },
  { key: 'roles.assign', name: 'Rollen vergeben und entziehen', group: 'Rollen und Rechte' }
];

const KEYS = CATALOG.map((c) => c.key);
/** Betrachter ohne roles.manage (nur lesend): die API sperrt jede Aktion. */
const role = (over: Record<string, unknown>) => baseRole(over, { catalogKeys: KEYS, forbidden: true });
const CREATE = createBlock({ catalogKeys: KEYS, forbidden: true });

const ROLES = [
  role({ key: 'schuladmin', name: 'Schuladmin', description: 'Alle Rechte an der Schulinstanz.', permissions: ['accounts.view', 'roles.manage', 'roles.assign'], all_permissions: true, requires_mfa: true, protection: 'wildcard', account_count: 2 }),
  role({ key: 'schueler', name: 'Schüler/in', protection: 'protected', account_count: 120 }),
  role({ key: 'lehrkraft', name: 'Lehrkraft', permissions: ['accounts.view', 'roles.assign'], requires_mfa: true, account_count: 14 }),
  role({ key: 'r_ab12', name: 'Vertretungsplan', description: 'Eigene Rolle.', permissions: ['x.unbekannt'], requires_mfa: true, protection: 'custom' })
];

const routes = {
  'GET /api/roles': { data: { roles: ROLES, create: CREATE } },
  'GET /api/permissions': { data: { permissions: CATALOG } }
};

const rowOf = async (name: string) => (await screen.findByRole('rowheader', { name: new RegExp(name) })).closest('tr')!;

describe('Rollen: Liste', () => {
  it('zeigt waehrend des Ladens einen Hinweis und danach Name, Beschreibung und Anzahl der Konten', async () => {
    render(<RolesPage apiClient={fakeClient(routes).client} />);

    expect(screen.getByText('Rollen werden geladen …')).toBeInTheDocument();

    const admin = await rowOf('Schuladmin');
    expect(within(admin).getByText('Alle Rechte an der Schulinstanz.')).toBeInTheDocument();
    expect(within(admin).getByText('2')).toBeInTheDocument();
    expect(within(await rowOf('Lehrkraft')).getByText('14')).toBeInTheDocument();
  });

  it('zeigt Wildcard-Rollen als „Alle Rechte“ und niemals einen Stern', async () => {
    render(<RolesPage apiClient={fakeClient(routes).client} />);

    const admin = await rowOf('Schuladmin');
    expect(within(admin).getByText('Alle Rechte')).toBeInTheDocument();
    expect(within(admin).queryByText('Konten ansehen')).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('*');
  });

  it('nennt die Rechte einer Rolle mit deutschem Namen aus dem Katalog, unbekannte mit Schluessel', async () => {
    render(<RolesPage apiClient={fakeClient(routes).client} />);

    const lehrkraft = await rowOf('Lehrkraft');
    expect(within(lehrkraft).getByText('Konten ansehen')).toBeInTheDocument();
    expect(within(lehrkraft).getByText('Rollen vergeben und entziehen')).toBeInTheDocument();
    expect(within(await rowOf('Vertretungsplan')).getByText('x.unbekannt')).toBeInTheDocument();
  });

  it('sagt bei Rollen ohne Rechte „Keine Rechte“', async () => {
    render(<RolesPage apiClient={fakeClient(routes).client} />);

    expect(within(await rowOf('Schüler/in')).getByText('Keine Rechte')).toBeInTheDocument();
  });

  it('zeigt MFA-Merkmal und Schutzstufe verstaendlich', async () => {
    render(<RolesPage apiClient={fakeClient(routes).client} />);

    const admin = await rowOf('Schuladmin');
    expect(within(admin).getByText('Alle Rechte fest')).toBeInTheDocument();
    expect(within(admin).getByText('Ja')).toBeInTheDocument();
    const schueler = await rowOf('Schüler/in');
    expect(within(schueler).getByText('Rechte fest')).toBeInTheDocument();
    expect(within(schueler).getByText('Nein')).toBeInTheDocument();
    expect(within(await rowOf('Lehrkraft')).getByText('Standardrolle')).toBeInTheDocument();
    expect(within(await rowOf('Vertretungsplan')).getByText('Eigene Rolle')).toBeInTheDocument();
  });

  it('ohne Recht „Rollen verwalten“ (laut API) sind alle Schreibaktionen deaktiviert und es gibt kein Formular', async () => {
    render(<RolesPage apiClient={fakeClient(routes).client} />);

    await rowOf('Schuladmin');
    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled();
    }
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('zeigt bei einem Ladefehler eine Meldung und laedt auf Wunsch erneut', async () => {
    let attempts = 0;
    const { client } = fakeClient({
      ...routes,
      'GET /api/roles': () => (++attempts === 1 ? { status: 500 } : { data: { roles: ROLES, create: CREATE } })
    });
    render(<RolesPage apiClient={client} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Die Rollen konnten nicht geladen werden');
    await userEvent.click(screen.getByRole('button', { name: 'Erneut laden' }));

    expect(await rowOf('Lehrkraft')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('zeigt Rollen auch, wenn der Katalog nicht ladbar ist, dann mit den Rechte-Schluesseln', async () => {
    const { client } = fakeClient({ ...routes, 'GET /api/permissions': { status: 500 } });
    render(<RolesPage apiClient={client} />);

    expect(within(await rowOf('Lehrkraft')).getByText('roles.assign')).toBeInTheDocument();
  });
});
