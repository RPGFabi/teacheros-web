import { useCallback, useEffect, useState } from 'react';
import { Button, Card } from '@hoelzle/react-ui';
import type { AxiosInstance } from 'axios';
import { permissionName, protectionLabel, type CatalogEntry, type RoleRow } from './roles';

interface Props {
  apiClient: AxiosInstance;
}

/**
 * Seite „Rollen“ (Ticket #32): die Rollen der Schulinstanz, nur lesend. Der Menuepunkt erscheint mit einem
 * der drei Verwaltungsrechte; das Anlegen und Bearbeiten (#33) und Vergeben (#34) bauen auf dieser Liste auf.
 */
export default function RolesPage({ apiClient }: Props) {
  const [roles, setRoles] = useState<RoleRow[] | null>(null);
  // Ohne Katalog (Ladefehler) zeigt die Liste die Schluessel statt der deutschen Namen.
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    const [rolesResult, catalogResult] = await Promise.allSettled([
      apiClient.get<{ roles: RoleRow[] }>('/api/roles'),
      apiClient.get<{ permissions: CatalogEntry[] }>('/api/permissions')
    ]);
    if (catalogResult.status === 'fulfilled') {
      setCatalog(catalogResult.value.data.permissions);
    }
    if (rolesResult.status === 'fulfilled') {
      setRoles(rolesResult.value.data.roles);
    } else {
      setLoadError(true);
    }
  }, [apiClient]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="content">
      <h1>Rollen</h1>
      <Card>
        {loadError && (
          <>
            <p role="alert">Die Rollen konnten nicht geladen werden.</p>
            <Button variant="secondary" onClick={() => void load()}>Erneut laden</Button>
          </>
        )}
        {!loadError && roles === null && <p>Rollen werden geladen …</p>}
        {!loadError && roles !== null && roles.length === 0 && <p>Es gibt noch keine Rollen.</p>}
        {!loadError && roles !== null && roles.length > 0 && (
          <table>
            <thead>
              <tr>
                <th scope="col">Rolle</th>
                <th scope="col">Art</th>
                <th scope="col">Erfordert MFA</th>
                <th scope="col">Konten</th>
                <th scope="col">Rechte</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id}>
                  <th scope="row">
                    {role.name}
                    {role.description && <small style={{ display: 'block', fontWeight: 'normal' }}>{role.description}</small>}
                  </th>
                  <td>{protectionLabel(role.protection)}</td>
                  <td>{role.requires_mfa ? 'Ja' : 'Nein'}</td>
                  <td>{role.account_count}</td>
                  <td>
                    {role.all_permissions ? (
                      'Alle Rechte'
                    ) : role.permissions.length === 0 ? (
                      'Keine Rechte'
                    ) : (
                      <ul>
                        {role.permissions.map((key) => (
                          <li key={key}>{permissionName(catalog, key)}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </main>
  );
}
