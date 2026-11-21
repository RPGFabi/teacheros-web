import { useCallback, useState, type FormEvent } from 'react';
import { Button, Card, Checkbox, Chip, ConfirmDialog, FormField, TextInput } from '@hoelzle/react-ui';
import type { AxiosInstance } from 'axios';
import { useResource } from '../shared/useResource';
import SubjectEditForm from './SubjectEditForm';
import { describeSubjectFailure, MAX_CODE_LENGTH, MAX_NAME_LENGTH, subjectFormProblem, type Subject, type SubjectAction } from './subjects';

interface Props {
  apiClient: AxiosInstance;
  /** Recht `subjects.manage` aus GET /api/me; ohne es gibt es weder Anlegen-Formular noch Aktionen (die API verweigert sie ohnehin). */
  canManage: boolean;
}

/**
 * Seite „Fächer“ (Tickets #62, #63): die Faecher der Schulinstanz in der Reihenfolge der API (natuerlich nach Kuerzel) und, mit
 * `subjects.manage`, das Anlegen mit Kuerzel und Bezeichnung sowie Bearbeiten (nur die Bezeichnung), Archivieren,
 * Wiederherstellen und Loeschen (mit Bestaetigung). Archivierte Faecher (Glossar: Archivierung) sind ausgeblendet und mit dem
 * Schalter „Archivierte anzeigen“ sichtbar, dann markiert und nur wiederherstellbar oder loeschbar. Ob ein Fach verknuepft ist,
 * entscheidet allein die API (`subject_linked`). Ein Fach gilt unabhaengig vom Schuljahr. Die Tabelle wird auf dem Smartphone per
 * CSS zu Karten (`data-label` je Zelle).
 */
export default function SubjectsPage({ apiClient, canManage }: Props) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [deleting, setDeleting] = useState<Subject | null>(null);

  const fetchSubjects = useCallback(
    async () => (await apiClient.get<{ subjects: Subject[] }>('/api/subjects', showArchived ? { params: { include_archived: 1 } } : undefined)).data.subjects,
    [apiClient, showArchived]
  );
  // Schreibzugriffe laden danach immer neu, auch nach einem Fehler: die Liste kann sich inzwischen geaendert haben.
  const { data: subjects, loadError, reload: load, busy, notice, error, run } = useResource<Subject[], SubjectAction>(fetchSubjects, describeSubjectFailure);

  const problem = subjectFormProblem(code, name);
  // Ein Hinweis erscheint erst, wenn schon etwas eingegeben ist; ein leeres Formular ist nur gesperrt.
  const hint = code !== '' || name !== '' ? problem : undefined;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (problem !== undefined) {
      return;
    }
    const ok = await run('create', async () => {
      const { data } = await apiClient.post<{ subject: Subject }>('/api/subjects', { code: code.trim(), name: name.trim() });
      return `Fach ${data.subject.code} angelegt.`;
    });
    if (ok) {
      setCode('');
      setName('');
    }
  };

  /** Eine Aktion auf einem Fach (`POST /api/subjects/:id/<pfad>`); `success` ist die Erfolgsmeldung. */
  const act = (action: SubjectAction, target: Subject, path: string, success: string, body?: object) =>
    run(action, async () => {
      await apiClient.post(`/api/subjects/${target.id}/${path}`, body);
      return success;
    });

  const save = async (target: Subject, newName: string) => {
    if (await act('update', target, 'update', `Fach ${target.code} gespeichert.`, { name: newName })) {
      setEditing(null);
    }
  };

  const remove = async (target: Subject) => {
    setDeleting(null);
    if ((await act('delete', target, 'delete', `Fach ${target.code} gelöscht.`)) && editing?.id === target.id) {
      setEditing(null);
    }
  };

  return (
    <main className="content">
      <h1>Fächer</h1>
      {canManage && editing && !editing.archived && (
        <SubjectEditForm key={editing.id} subject={editing} busy={busy} onSubmit={(newName) => void save(editing, newName)} onCancel={() => setEditing(null)} />
      )}
      {canManage && (
        <Card>
          <form aria-label="Fach anlegen" onSubmit={(event) => void submit(event)}>
            <h2>Fach anlegen</h2>
            <FormField label="Kürzel" htmlFor="subject-code">
              <TextInput id="subject-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="z. B. Ma" />
            </FormField>
            <FormField label="Bezeichnung" htmlFor="subject-name">
              <TextInput id="subject-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Mathematik" />
            </FormField>
            <p>
              Das Kürzel ist an der Schulinstanz eindeutig, Groß- und Kleinschreibung zählt nicht (1 bis {MAX_CODE_LENGTH} Zeichen). Nach dem Anlegen lässt sich das
              Kürzel nicht mehr ändern. Die Bezeichnung hat bis zu {MAX_NAME_LENGTH} Zeichen und muss nicht eindeutig sein.
            </p>
            <p aria-live="polite">{hint !== undefined && <span role="alert">{hint}</span>}</p>
            <Button type="submit" disabled={busy || problem !== undefined}>Anlegen</Button>
          </form>
        </Card>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      <ConfirmDialog
        open={deleting !== null}
        title={`Fach ${deleting?.code ?? ''} löschen?`}
        description={`Fach ${deleting?.code ?? ''} (${deleting?.name ?? ''}) wird endgültig gelöscht, das Kürzel ist danach wieder frei. Das lässt sich nicht rückgängig machen. Ist am Fach schon etwas verknüpft, wird es nicht gelöscht; dann bleibt das Archivieren.`}
        confirmText="Löschen"
        variant="danger"
        onConfirm={() => deleting && void remove(deleting)}
        onCancel={() => setDeleting(null)}
      />
      <Card>
        <Checkbox label="Archivierte anzeigen" checked={showArchived} onChange={() => setShowArchived((value) => !value)} />
        {loadError && (
          <>
            <p role="alert">Die Fächer konnten nicht geladen werden.</p>
            <Button variant="secondary" onClick={() => void load()}>Erneut laden</Button>
          </>
        )}
        {!loadError && subjects === null && <p>Fächer werden geladen …</p>}
        {!loadError && subjects !== null && subjects.length === 0 && <p>Es gibt noch kein Fach.</p>}
        {!loadError && subjects !== null && subjects.length > 0 && (
          <table className="responsive-table">
            <thead>
              <tr>
                <th scope="col">Kürzel</th>
                <th scope="col">Bezeichnung</th>
                {canManage && <th scope="col">Aktionen</th>}
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.id}>
                  <th scope="row">
                    {s.code}
                    {s.archived && (
                      <>
                        {' '}
                        <Chip variant="neutral">Archiviert</Chip>
                      </>
                    )}
                  </th>
                  <td data-label="Bezeichnung">{s.name}</td>
                  {canManage && (
                    <td data-label="Aktionen">
                      {!s.archived && (
                        <>
                          <Button variant="secondary" disabled={busy} aria-label={`Bearbeiten: ${s.code}`} onClick={() => setEditing(s)}>Bearbeiten</Button>{' '}
                          <Button
                            variant="secondary"
                            disabled={busy}
                            aria-label={`Archivieren: ${s.code}`}
                            onClick={() => void act('archive', s, 'archive', `Fach ${s.code} archiviert.`)}
                          >
                            Archivieren
                          </Button>{' '}
                        </>
                      )}
                      {s.archived && (
                        <>
                          <Button
                            variant="secondary"
                            disabled={busy}
                            aria-label={`Wiederherstellen: ${s.code}`}
                            onClick={() => void act('restore', s, 'restore', `Fach ${s.code} wiederhergestellt.`)}
                          >
                            Wiederherstellen
                          </Button>{' '}
                        </>
                      )}
                      <Button variant="secondary" disabled={busy} aria-label={`Löschen: ${s.code}`} onClick={() => setDeleting(s)}>Löschen</Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </main>
  );
}
