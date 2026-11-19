import { sourceLabel, type PermissionSource, type PermissionRow } from './access';

/** Herkunft eines Rechts als Liste (Rolle, Einzelrecht, entzogen); ohne Herkunft steht „Keine“. */
export function PermissionSources({ sources }: { sources: PermissionSource[] }) {
  if (sources.length === 0) {
    return <>Keine</>;
  }
  return (
    <ul>
      {sources.map((source, index) => (
        <li key={index}>{sourceLabel(source)}</li>
      ))}
    </ul>
  );
}

/** Effektive Rechte eines Kontos mit Herkunft (Rolle, Einzelrecht, entzogen), nur lesend. */
export default function EffectivePermissions({ permissions }: { permissions: PermissionRow[] }) {
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
        </tr>
      </thead>
      <tbody>
        {permissions.map((permission) => (
          <tr key={permission.key}>
            <th scope="row">{permission.name}</th>
            <td>
              <PermissionSources sources={permission.sources} />
            </td>
            <td>{permission.effective ? 'Gilt' : 'Gilt nicht'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
