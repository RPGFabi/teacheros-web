import { useCallback, useEffect, useId, useState } from 'react';
import { Button, Card, ConfirmDialog } from '@hoelzle/react-ui';
import type { AxiosInstance } from 'axios';
import RoleForm, { type RolePayload } from './RoleForm';
import { blockedReason, describeRoleFailure, permissionName, protectionLabel, type CatalogEntry, type CreateAction, type RoleAction, type RoleRow, type RolesResponse } from './roles';

interface Props {
  apiClient: AxiosInstance;
}

interface Editor {
  /** `null` = neue Rolle. */
  role: RoleRow | null;
}

/**
 * Seite „Rollen“: die Rollen der Schulinstanz (Ticket #32) und ihr Anlegen, Bearbeiten und Loeschen (Ticket #33).
 * Der Menuepunkt erscheint mit einem der drei Verwaltungsrechte, schreiben darf nur `roles.manage`.
 * Was der Betrachter darf, sagt die API je Aktion (`actions`, `permission_actions`, `create` in `GET /api/roles`):
 * nicht erlaubte Aktionen bleiben sichtbar, aber deaktiviert, mit der Begruendung der API. Hier wird nichts nachgerechnet.
 */
export default function RolesPage({ apiClient }: Props) {
  const [roles, setRoles] = useState<RoleRow[] | null>(null);
  const [create, setCreate] = useState<CreateAction | null>(null);
  // Ohne Katalog (Ladefehler) zeigt die Liste die Schluessel statt der deutschen Namen.
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [deleting, setDeleting] = useState<RoleRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const manageReasonId = useId();
  // Ohne Auskunft der API (noch nicht geladen, Ladefehler) bleibt Anlegen gesperrt.
  const createReason = blockedReason(create ?? undefined);

  const load = useCallback(async () => {
    setLoadError(false);
    const [rolesResult, catalogResult] = await Promise.allSettled([
      apiClient.get<RolesResponse>('/api/roles'),
      apiClient.get<{ permissions: CatalogEntry[] }>('/api/permissions')
    ]);
    if (catalogResult.status === 'fulfilled') {
      setCatalog(catalogResult.value.data.permissions);
    }
    if (rolesResult.status === 'fulfilled') {
      setRoles(rolesResult.value.data.roles);
      setCreate(rolesResult.value.data.create ?? null);
    } else {
      setLoadError(true);
    }
  }, [apiClient]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<string>, failure: string, onSuccess: () => void) {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      setNotice(await action());
      onSuccess();
    } catch (err) {
      setError(describeRoleFailure(err, failure));
    } finally {
      setBusy(false);
    }
    // Auch nach einem Fehler neu laden: die Rolle kann sich inzwischen geaendert haben oder weg sein.
    await load();
  }

  const save = (role: RoleRow | null, payload: RolePayload) =>
    run(
      async () => {
        if (role) {
          await apiClient.post(`/api/roles/${role.id}/update`, payload);
          return `Rolle „${payload.name}“ gespeichert.`;
        }
        await apiClient.post('/api/roles', payload);
        return `Rolle „${payload.name}“ angelegt.`;
      },
      role ? 'Die Rolle konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.' : 'Die Rolle konnte nicht angelegt werden. Bitte versuchen Sie es erneut.',
      () => setEditor(null)
    );

  const remove = (role: RoleRow) => {
    setDeleting(null);
    return run(
      async () => {
        await apiClient.post(`/api/roles/${role.id}/delete`);
        return `Rolle „${role.name}“ gelöscht.`;
      },
      'Die Rolle konnte nicht gelöscht werden. Bitte versuchen Sie es erneut.',
      () => undefined
    );
  };

  const startEditor = (role: RoleRow | null) => {
    setNotice(null);
    setError(null);
    setEditor({ role });
  };

  return (
    <main className="content">
      <h1>Rollen</h1>
      <p>
        <Button
          disabled={createReason !== null || busy}
          aria-describedby={createReason === null ? undefined : manageReasonId}
          onClick={() => startEditor(null)}
        >
          Rolle anlegen
        </Button>
      </p>
      {createReason !== null && (
        <p id={manageReasonId}>
          <small>{createReason}</small>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      {editor && (
        <RoleForm
          key={editor.role?.id ?? 'neu'}
          role={editor.role}
          catalog={catalog}
          permissionActions={editor.role ? editor.role.permission_actions : (create?.permission_actions ?? [])}
          mfaAction={editor.role ? (editor.role.actions.find((a) => a.action === 'set_mfa') ?? REFUSED) : null}
          busy={busy}
          onSubmit={(payload) => void save(editor.role, payload)}
          onCancel={() => setEditor(null)}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={`Rolle „${deleting?.name ?? ''}“ löschen?`}
        description="Die Rolle wird endgültig gelöscht. Das lässt sich nicht rückgängig machen."
        confirmText="Löschen"
        variant="danger"
        onConfirm={() => deleting && void remove(deleting)}
        onCancel={() => setDeleting(null)}
      />
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
                <th scope="col">Aktionen</th>
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
                  <td>
                    <RoleActions
                      role={role}
                      busy={busy}
                      editReason={blockedReason(findAction(role, 'edit'))}
                      deleteReason={blockedReason(findAction(role, 'delete'))}
                      onEdit={() => startEditor(role)}
                      onDelete={() => setDeleting(role)}
                    />
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

const findAction = (role: RoleRow, action: RoleAction['action']) => role.actions.find((a) => a.action === action);
const REFUSED = { allowed: false, code: null, reason: null };

interface ActionsProps {
  role: RoleRow;
  busy: boolean;
  /** Begruendung der API, warum Bearbeiten bzw. Loeschen gesperrt ist; `null` = erlaubt. */
  editReason: string | null;
  deleteReason: string | null;
  onEdit: () => void;
  onDelete: () => void;
}

/** Bearbeiten und Loeschen einer Rolle; eine gesperrte Aktion bleibt stehen, mit Begruendung der API darunter. */
function RoleActions({ role, busy, editReason, deleteReason, onEdit, onDelete }: ActionsProps) {
  const id = useId();
  return (
    <>
      <Button
        variant="secondary"
        disabled={busy || editReason !== null}
        aria-label={`Bearbeiten: ${role.name}`}
        aria-describedby={editReason ? `${id}-edit` : undefined}
        onClick={onEdit}
      >
        Bearbeiten
      </Button>{' '}
      <Button
        variant="secondary"
        disabled={busy || deleteReason !== null}
        aria-label={`Löschen: ${role.name}`}
        aria-describedby={deleteReason ? `${id}-delete` : undefined}
        onClick={onDelete}
      >
        Löschen
      </Button>
      {editReason && (
        <small id={`${id}-edit`} style={{ display: 'block' }}>{editReason}</small>
      )}
      {deleteReason && (
        <small id={`${id}-delete`} style={{ display: 'block' }}>{deleteReason}</small>
      )}
    </>
  );
}
