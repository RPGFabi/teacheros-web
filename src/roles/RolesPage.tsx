import { useCallback, useEffect, useId, useState } from 'react';
import { Button, Card, ConfirmDialog } from '@hoelzle/react-ui';
import type { AxiosInstance } from 'axios';
import RoleForm, { type RolePayload } from './RoleForm';
import { describeRoleFailure, permissionName, protectionLabel, type CatalogEntry, type RoleRow } from './roles';

interface Props {
  apiClient: AxiosInstance;
  /** Recht `roles.manage` aus GET /api/me; ohne es sind Anlegen, Bearbeiten und Loeschen sichtbar, aber deaktiviert. */
  canManage?: boolean;
  /** Effektive Rechte des Kontos aus GET /api/me: nur diese lassen sich Rollen hinzufuegen (P2). */
  heldPermissions?: string[];
}

interface Editor {
  /** `null` = neue Rolle. */
  role: RoleRow | null;
}

/**
 * Seite „Rollen“: die Rollen der Schulinstanz (Ticket #32) und ihr Anlegen, Bearbeiten und Loeschen (Ticket #33).
 * Der Menuepunkt erscheint mit einem der drei Verwaltungsrechte, schreiben darf nur `roles.manage`.
 * Nicht erlaubte Aktionen bleiben sichtbar, aber deaktiviert, mit Begruendung; die API entscheidet endgueltig.
 */
export default function RolesPage({ apiClient, canManage = false, heldPermissions = [] }: Props) {
  const [roles, setRoles] = useState<RoleRow[] | null>(null);
  // Ohne Katalog (Ladefehler) zeigt die Liste die Schluessel statt der deutschen Namen.
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [deleting, setDeleting] = useState<RoleRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const manageReasonId = useId();

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
          await apiClient.patch(`/api/roles/${role.id}`, payload);
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
        await apiClient.delete(`/api/roles/${role.id}`);
        return `Rolle „${role.name}“ gelöscht.`;
      },
      'Die Rolle konnte nicht gelöscht werden. Bitte versuchen Sie es erneut.',
      () => undefined
    );
  };

  /** Begruendung, warum eine Aktion auf einer Rolle gerade nicht geht; `null` = erlaubt. */
  const editBlocked = (role: RoleRow) =>
    role.protection === 'wildcard' || role.protection === 'protected' ? 'Diese Rolle ist geschützt: Ihre Rechte liegen fest.' : null;
  const deleteBlocked = (role: RoleRow) =>
    role.protection !== 'custom'
      ? 'Standardrollen lassen sich nicht löschen.'
      : role.account_count > 0
        ? `Die Rolle ist noch ${role.account_count} ${role.account_count === 1 ? 'Konto' : 'Konten'} zugewiesen.`
        : null;

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
          disabled={!canManage || busy}
          aria-describedby={canManage ? undefined : manageReasonId}
          onClick={() => startEditor(null)}
        >
          Rolle anlegen
        </Button>
      </p>
      {!canManage && (
        <p id={manageReasonId}>
          <small>Zum Anlegen, Bearbeiten und Löschen von Rollen brauchen Sie das Recht „Rollen verwalten“.</small>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      {editor && (
        <RoleForm
          key={editor.role?.id ?? 'neu'}
          role={editor.role}
          catalog={catalog}
          heldPermissions={heldPermissions}
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
                      canManage={canManage}
                      busy={busy}
                      manageReasonId={manageReasonId}
                      editReason={editBlocked(role)}
                      deleteReason={deleteBlocked(role)}
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

interface ActionsProps {
  role: RoleRow;
  canManage: boolean;
  busy: boolean;
  manageReasonId: string;
  editReason: string | null;
  deleteReason: string | null;
  onEdit: () => void;
  onDelete: () => void;
}

/** Bearbeiten und Loeschen einer Rolle; eine gesperrte Aktion bleibt stehen, mit Begruendung darunter. */
function RoleActions({ role, canManage, busy, manageReasonId, editReason, deleteReason, onEdit, onDelete }: ActionsProps) {
  const id = useId();
  const reasonFor = (reason: string | null, own: string) => (!canManage ? manageReasonId : reason ? own : undefined);
  return (
    <>
      <Button
        variant="secondary"
        disabled={!canManage || busy || editReason !== null}
        aria-label={`Bearbeiten: ${role.name}`}
        aria-describedby={reasonFor(editReason, `${id}-edit`)}
        onClick={onEdit}
      >
        Bearbeiten
      </Button>{' '}
      <Button
        variant="secondary"
        disabled={!canManage || busy || deleteReason !== null}
        aria-label={`Löschen: ${role.name}`}
        aria-describedby={reasonFor(deleteReason, `${id}-delete`)}
        onClick={onDelete}
      >
        Löschen
      </Button>
      {canManage && editReason && (
        <small id={`${id}-edit`} style={{ display: 'block' }}>{editReason}</small>
      )}
      {canManage && deleteReason && (
        <small id={`${id}-delete`} style={{ display: 'block' }}>{deleteReason}</small>
      )}
    </>
  );
}
