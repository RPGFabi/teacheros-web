import { useEffect, useState } from 'react';
import { Button, Card } from '@hoelzle/react-ui';
import type { AxiosInstance } from 'axios';
import { visiblePortals, type PortalId } from './app/routes';
import AccountPage, { type Me } from './account/AccountPage';
import { ACCOUNT_DETAIL_PERMISSIONS, hasPermission } from './account/permissions';
import AccountsPage from './accounts/AccountsPage';
import RolesPage from './roles/RolesPage';
import { apiClient as defaultApiClient } from './api/client';

export default function App({ apiClient = defaultApiClient, initialPortal = 'teacher' }: { apiClient?: AxiosInstance; initialPortal?: PortalId }) {
  const [active, setActive] = useState<PortalId>(initialPortal);
  const [menuOpen, setMenuOpen] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [meError, setMeError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<Me>('/api/me')
      .then((response) => !cancelled && setMe(response.data))
      // Ein gesperrtes Konto (401 account_inactive) meldet der Gate in Root ab und erklaert es auf der Anmeldeseite.
      .catch(() => !cancelled && setMeError('Die Kontodaten konnten nicht geladen werden.'));
    return () => {
      cancelled = true;
    };
  }, [apiClient]);

  // Die API liefert Module und Rechte fertig; hier wird nur nachgeschlagen, nichts ausgewertet.
  const shownPortals = visiblePortals(me);
  const portal = shownPortals.find((p) => p.id === active) ?? shownPortals[0];

  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="brand">Schulplattform</span>
        <Button
          variant="ghost"
          className="menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="main-nav"
          onClick={() => setMenuOpen((open) => !open)}
        >
          Menü
        </Button>
      </header>
      <nav id="main-nav" aria-label="Hauptnavigation" className={menuOpen ? 'nav nav-open' : 'nav'}>
        {shownPortals.map((p) => (
          <a
            key={p.id}
            href={p.path}
            aria-current={p.id === portal.id ? 'page' : undefined}
            onClick={(event) => {
              event.preventDefault();
              setActive(p.id);
              setMenuOpen(false);
            }}
          >
            {p.label}
          </a>
        ))}
      </nav>
      {portal.id === 'account' ? (
        <AccountPage me={me} error={meError} />
      ) : portal.id === 'accounts' ? (
        <AccountsPage
          apiClient={apiClient}
          canInvite={hasPermission(me, 'accounts.invite')}
          canViewAccess={hasPermission(me, 'accounts.view') && ACCOUNT_DETAIL_PERMISSIONS.some((permission) => hasPermission(me, permission))}
          canAssignRoles={hasPermission(me, 'roles.assign')}
          canAssignPermissions={hasPermission(me, 'permissions.assign')}
        />
      ) : portal.id === 'roles' ? (
        <RolesPage apiClient={apiClient} />
      ) : (
        <main className="content">
          <h1>{portal.label}</h1>
          <Card>
            <p>{portal.description}</p>
          </Card>
        </main>
      )}
    </div>
  );
}
