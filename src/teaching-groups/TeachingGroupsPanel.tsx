import { useCallback, useState } from 'react';
import { Button, Card, Checkbox, Chip, ConfirmDialog } from '@hoelzle/react-ui';
import type { AxiosInstance } from 'axios';
import { useResource } from '../shared/useResource';
import TeachingGroupEditForm from './TeachingGroupEditForm';
import TeachingGroupForm from './TeachingGroupForm';
import { classNames, describeTeachingGroupFailure, type TeachingGroup, type TeachingGroupAction } from './teachingGroups';

interface Props {
  apiClient: AxiosInstance;
  schoolYear: { id: string; name: string };
  /** Recht `teaching_groups.manage` aus GET /api/me; ohne es gibt es weder Formular noch Aktionen (die API verweigert sie ohnehin). */
  canManage: boolean;
  /** Oeffnet die Detailansicht einer Fachgruppe (Kennung). */
  onOpen: (id: string) => void;
}

/**
 * Die Fachgruppen eines Schuljahres (Ticket #64): Liste in der Reihenfolge der API (nach Fachkuerzel, dann natuerlich nach
 * Bezeichnung) mit Fach und Klassen, dazu mit `teaching_groups.manage` das Anlegen-Formular sowie (Ticket #65) Bearbeiten,
 * Archivieren, Wiederherstellen und Loeschen (mit Bestaetigung). Archivierte Fachgruppen (Glossar: Archivierung) sind
 * ausgeblendet und mit dem Schalter „Archivierte anzeigen“ sichtbar, dann markiert und nur wiederherstellbar oder loeschbar.
 * Ob eine Fachgruppe verknuepft ist, entscheidet allein die API (`teaching_group_linked`). Die Tabelle wird auf dem
 * Smartphone per CSS zu Karten (`data-label` je Zelle). Beim Wechsel des Schuljahres neu mounten (`key`), dann beginnen
 * Eingaben und Meldungen frisch.
 */
export default function TeachingGroupsPanel({ apiClient, schoolYear, canManage, onOpen }: Props) {
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<TeachingGroup | null>(null);
  const [deleting, setDeleting] = useState<TeachingGroup | null>(null);

  const fetchGroups = useCallback(async () => {
    const params = showArchived ? { school_year_id: schoolYear.id, include_archived: 1 } : { school_year_id: schoolYear.id };
    return (await apiClient.get<{ teaching_groups: TeachingGroup[] }>('/api/teaching-groups', { params })).data.teaching_groups;
  }, [apiClient, schoolYear.id, showArchived]);
  // Schreibzugriffe laden danach immer neu, auch nach einem Fehler: die Liste kann sich inzwischen geaendert haben.
  const { data: groups, loadError, reload: load, busy, notice, error, run } = useResource<TeachingGroup[], TeachingGroupAction>(fetchGroups, describeTeachingGroupFailure);

  /** Eine Aktion auf einer Fachgruppe (`POST /api/teaching-groups/:id/<pfad>`); `success` ist die Erfolgsmeldung. */
  const act = (action: TeachingGroupAction, target: TeachingGroup, path: string, success: string, body?: object) =>
    run(action, async () => {
      await apiClient.post(`/api/teaching-groups/${target.id}/${path}`, body);
      return success;
    });

  const save = async (target: TeachingGroup, name: string, classIds: string[]) => {
    if (await act('update', target, 'update', `Fachgruppe ${name} gespeichert.`, { name, class_ids: classIds })) {
      setEditing(null);
    }
  };

  const remove = async (target: TeachingGroup) => {
    setDeleting(null);
    if ((await act('delete', target, 'delete', `Fachgruppe ${target.name} gelöscht.`)) && editing?.id === target.id) {
      setEditing(null);
    }
  };

  return (
    <>
      {canManage && editing && !editing.archived && (
        <TeachingGroupEditForm
          key={editing.id}
          apiClient={apiClient}
          group={editing}
          busy={busy}
          onSubmit={(name, classIds) => void save(editing, name, classIds)}
          onCancel={() => setEditing(null)}
        />
      )}
      {canManage && <TeachingGroupForm apiClient={apiClient} schoolYear={schoolYear} onChanged={load} />}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      <ConfirmDialog
        open={deleting !== null}
        title={`Fachgruppe ${deleting?.name ?? ''} löschen?`}
        description={`Fachgruppe ${deleting?.name ?? ''} (Schuljahr ${schoolYear.name}) wird endgültig gelöscht; ihre Klassen bleiben bestehen. Das lässt sich nicht rückgängig machen. Ist an der Fachgruppe schon etwas verknüpft, wird sie nicht gelöscht; dann bleibt das Archivieren.`}
        confirmText="Löschen"
        variant="danger"
        onConfirm={() => deleting && void remove(deleting)}
        onCancel={() => setDeleting(null)}
      />
      <Card>
        <Checkbox label="Archivierte anzeigen" checked={showArchived} onChange={() => setShowArchived((value) => !value)} />
        {loadError && (
          <>
            <p role="alert">Die Fachgruppen konnten nicht geladen werden.</p>
            <Button variant="secondary" onClick={() => void load()}>Erneut laden</Button>
          </>
        )}
        {!loadError && groups === null && <p>Fachgruppen werden geladen …</p>}
        {!loadError && groups !== null && groups.length === 0 && <p>In diesem Schuljahr gibt es noch keine Fachgruppe.</p>}
        {!loadError && groups !== null && groups.length > 0 && (
          <table className="responsive-table">
            <thead>
              <tr>
                <th scope="col">Fachgruppe</th>
                <th scope="col">Fach</th>
                <th scope="col">Klassen</th>
                <th scope="col">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id}>
                  <th scope="row">
                    {g.name}
                    {g.archived && (
                      <>
                        {' '}
                        <Chip variant="neutral">Archiviert</Chip>
                      </>
                    )}
                  </th>
                  <td data-label="Fach">{g.subject.code}</td>
                  <td data-label="Klassen">{classNames(g.classes)}</td>
                  <td data-label="Aktionen">
                    <Button variant="secondary" aria-label={`Details: ${g.name}`} onClick={() => onOpen(g.id)}>Details</Button>
                    {canManage && (
                      <>
                        {' '}
                        {!g.archived && (
                          <>
                            <Button variant="secondary" disabled={busy} aria-label={`Bearbeiten: ${g.name}`} onClick={() => setEditing(g)}>Bearbeiten</Button>{' '}
                            <Button
                              variant="secondary"
                              disabled={busy}
                              aria-label={`Archivieren: ${g.name}`}
                              onClick={() => void act('archive', g, 'archive', `Fachgruppe ${g.name} archiviert.`)}
                            >
                              Archivieren
                            </Button>{' '}
                          </>
                        )}
                        {g.archived && (
                          <>
                            <Button
                              variant="secondary"
                              disabled={busy}
                              aria-label={`Wiederherstellen: ${g.name}`}
                              onClick={() => void act('restore', g, 'restore', `Fachgruppe ${g.name} wiederhergestellt.`)}
                            >
                              Wiederherstellen
                            </Button>{' '}
                          </>
                        )}
                        <Button variant="secondary" disabled={busy} aria-label={`Löschen: ${g.name}`} onClick={() => setDeleting(g)}>Löschen</Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
