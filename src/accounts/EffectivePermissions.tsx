import type { ReactNode } from 'react';
import { sourceLabel, type PermissionRow } from './access';

interface Props {
  permissions: PermissionRow[];
  /**
   * Andockpunkt fuer Ticket #36 (Einzelrechte gewaehren, entziehen, zuruecksetzen): erzeugt die Aktionen je Recht.
   * Ohne Angabe gibt es keine Aktionsspalte.
   */
  renderActions?: (permission: PermissionRow) => ReactNode;
}

/** Effektive Rechte eines Kontos mit Herkunft (Rolle, Einzelrecht, entzogen), nur lesend. */
export default function EffectivePermissions({ permissions, renderActions }: Props) {
  if (permissions.length === 0) {
    return <p>Dieses Konto hat keine Rechte.</p>;
  }
  return (
    <table>
      <thead>
        <tr>
          <th scope="col">Recht</th>
          <th scope="col">Herkunft</th>
          <th scope="col">Wirkung</th>
          {renderActions && <th scope="col">Aktion</th>}
        </tr>
      </thead>
      <tbody>
        {permissions.map((permission) => (
          <tr key={permission.key}>
            <th scope="row">{permission.name}</th>
            <td>
              <ul>
                {permission.sources.map((source, index) => (
                  <li key={index}>{sourceLabel(source)}</li>
                ))}
              </ul>
            </td>
            <td>{permission.effective ? 'Gilt' : 'Gilt nicht'}</td>
            {renderActions && <td>{renderActions(permission)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
