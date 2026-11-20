import { useCallback, useState, type FormEvent } from 'react';
import { Button, Card, Checkbox, Chip, ConfirmDialog, FormField, TextInput } from '@hoelzle/react-ui';
import type { AxiosInstance } from 'axios';
import { useResource } from '../shared/useResource';
import ClassEditForm from './ClassEditForm';
import { classFormProblem, describeClassFailure, MAX_GRADE_LEVEL, MIN_GRADE_LEVEL, type ClassAction, type SchoolClass } from './classes';

interface Props {
  apiClient: AxiosInstance;
  schoolYear: { id: string; name: string };
  /** Recht `classes.manage` aus GET /api/me; ohne es gibt es kein Anlegen-Formular (die API verweigert es ohnehin). */
  canManage: boolean;
}

/**
 * Die Klassen eines Schuljahres (Ticket #55): Liste nach Klassenstufe und Bezeichnung in der Reihenfolge der API und, mit
 * `classes.manage`, das Anlegen sowie (Ticket #57) Bearbeiten, Archivieren, Wiederherstellen und Loeschen (mit Bestaetigung).
 * Archivierte Klassen (Glossar: Archivierung) sind ausgeblendet und mit dem Schalter „Archivierte anzeigen“ sichtbar, dann
 * markiert und nur wiederherstellbar oder loeschbar. Ob eine Klasse verknuepft ist, entscheidet allein die API (`class_linked`).
 * Gebraucht auf der Seite „Klassen“ und in der Detailansicht eines Schuljahres. Die
 * Tabelle wird auf dem Smartphone per CSS zu Karten (`data-label` je Zelle). Beim Wechsel des Schuljahres neu mounten
 * (`key`), dann beginnen Eingaben und Meldungen frisch.
 */
export default function ClassesPanel({ apiClient, schoolYear, canManage }: Props) {
  const [gradeLevel, setGradeLevel] = useState('');
  const [name, setName] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<SchoolClass | null>(null);
  const [deleting, setDeleting] = useState<SchoolClass | null>(null);

  const fetchClasses = useCallback(async () => {
    const params = showArchived ? { school_year_id: schoolYear.id, include_archived: 1 } : { school_year_id: schoolYear.id };
    return (await apiClient.get<{ classes: SchoolClass[] }>('/api/classes', { params })).data.classes;
  }, [apiClient, schoolYear.id, showArchived]);
  // Schreibzugriffe laden danach immer neu, auch nach einem Fehler: die Liste kann sich inzwischen geaendert haben.
  const { data: classes, loadError, reload: load, busy, notice, error, run } = useResource<SchoolClass[], ClassAction>(fetchClasses, describeClassFailure);

  const problem = classFormProblem(gradeLevel, name);
  // Ein Hinweis erscheint erst, wenn schon etwas eingegeben ist; ein leeres Formular ist nur gesperrt.
  const hint = name !== '' || gradeLevel !== '' ? problem : undefined;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (problem !== undefined) {
      return;
    }
    const ok = await run('create', async () => {
      const { data } = await apiClient.post<{ class: SchoolClass }>('/api/classes', {
        school_year_id: schoolYear.id,
        grade_level: Number(gradeLevel),
        name: name.trim()
      });
      return `Klasse ${data.class.name} angelegt.`;
    });
    if (ok) {
      // Die Klassenstufe bleibt stehen: meist folgen weitere Klassen derselben Stufe (7a, 7b, ...).
      setName('');
    }
  };

  /** Eine Aktion auf einer Klasse (`POST /api/classes/:id/<pfad>`); `success` ist die Erfolgsmeldung. */
  const act = (action: ClassAction, target: SchoolClass, path: string, success: string, body?: object) =>
    run(action, async () => {
      await apiClient.post(`/api/classes/${target.id}/${path}`, body);
      return success;
    });

  const save = async (target: SchoolClass, grade: number, newName: string) => {
    if (await act('update', target, 'update', `Klasse ${newName} gespeichert.`, { grade_level: grade, name: newName })) {
      setEditing(null);
    }
  };

  const remove = async (target: SchoolClass) => {
    setDeleting(null);
    if ((await act('delete', target, 'delete', `Klasse ${target.name} gelöscht.`)) && editing?.id === target.id) {
      setEditing(null);
    }
  };

  return (
    <>
      {canManage && editing && !editing.archived && (
        <ClassEditForm
          key={editing.id}
          schoolClass={editing}
          busy={busy}
          onSubmit={(grade, newName) => void save(editing, grade, newName)}
          onCancel={() => setEditing(null)}
        />
      )}
      {canManage && (
        <Card>
          <form aria-label="Klasse anlegen" onSubmit={(event) => void submit(event)}>
            <h2>Klasse anlegen</h2>
            <FormField label="Klassenstufe" htmlFor="class-grade-level">
              <TextInput
                id="class-grade-level"
                type="number"
                min={MIN_GRADE_LEVEL}
                max={MAX_GRADE_LEVEL}
                step={1}
                inputMode="numeric"
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
              />
            </FormField>
            <FormField label="Bezeichnung" htmlFor="class-name">
              <TextInput id="class-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. 7a" />
            </FormField>
            <p>
              Die Klasse gehört zum Schuljahr {schoolYear.name} und lässt sich nicht in ein anderes verschieben. Die Bezeichnung ist im Schuljahr eindeutig, Groß- und
              Kleinschreibung zählt nicht.
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
        title={`Klasse ${deleting?.name ?? ''} löschen?`}
        description={`Klasse ${deleting?.name ?? ''} (Schuljahr ${schoolYear.name}) wird endgültig gelöscht. Das lässt sich nicht rückgängig machen. Ist an der Klasse schon etwas verknüpft, wird sie nicht gelöscht; dann bleibt das Archivieren.`}
        confirmText="Löschen"
        variant="danger"
        onConfirm={() => deleting && void remove(deleting)}
        onCancel={() => setDeleting(null)}
      />
      <Card>
        <Checkbox label="Archivierte anzeigen" checked={showArchived} onChange={() => setShowArchived((value) => !value)} />
        {loadError && (
          <>
            <p role="alert">Die Klassen konnten nicht geladen werden.</p>
            <Button variant="secondary" onClick={() => void load()}>Erneut laden</Button>
          </>
        )}
        {!loadError && classes === null && <p>Klassen werden geladen …</p>}
        {!loadError && classes !== null && classes.length === 0 && <p>In diesem Schuljahr gibt es noch keine Klasse.</p>}
        {!loadError && classes !== null && classes.length > 0 && (
          <table className="responsive-table">
            <thead>
              <tr>
                <th scope="col">Klasse</th>
                <th scope="col">Klassenstufe</th>
                {canManage && <th scope="col">Aktionen</th>}
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.id}>
                  <th scope="row">
                    {c.name}
                    {c.archived && (
                      <>
                        {' '}
                        <Chip variant="neutral">Archiviert</Chip>
                      </>
                    )}
                  </th>
                  <td data-label="Klassenstufe">{c.grade_level}</td>
                  {canManage && (
                    <td data-label="Aktionen">
                      {!c.archived && (
                        <>
                          <Button variant="secondary" disabled={busy} aria-label={`Bearbeiten: ${c.name}`} onClick={() => setEditing(c)}>Bearbeiten</Button>{' '}
                          <Button
                            variant="secondary"
                            disabled={busy}
                            aria-label={`Archivieren: ${c.name}`}
                            onClick={() => void act('archive', c, 'archive', `Klasse ${c.name} archiviert.`)}
                          >
                            Archivieren
                          </Button>{' '}
                        </>
                      )}
                      {c.archived && (
                        <>
                          <Button
                            variant="secondary"
                            disabled={busy}
                            aria-label={`Wiederherstellen: ${c.name}`}
                            onClick={() => void act('restore', c, 'restore', `Klasse ${c.name} wiederhergestellt.`)}
                          >
                            Wiederherstellen
                          </Button>{' '}
                        </>
                      )}
                      <Button variant="secondary" disabled={busy} aria-label={`Löschen: ${c.name}`} onClick={() => setDeleting(c)}>Löschen</Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
