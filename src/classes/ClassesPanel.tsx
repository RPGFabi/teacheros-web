import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button, Card, Checkbox, Chip, ConfirmDialog, FormField, TextInput } from '@hoelzle/react-ui';
import type { AxiosInstance } from 'axios';
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
  const [classes, setClasses] = useState<SchoolClass[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [gradeLevel, setGradeLevel] = useState('');
  const [name, setName] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<SchoolClass | null>(null);
  const [deleting, setDeleting] = useState<SchoolClass | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const params = showArchived ? { school_year_id: schoolYear.id, include_archived: 1 } : { school_year_id: schoolYear.id };
      const response = await apiClient.get<{ classes: SchoolClass[] }>('/api/classes', { params });
      setClasses(response.data.classes);
    } catch {
      setLoadError(true);
    }
  }, [apiClient, schoolYear.id, showArchived]);

  useEffect(() => {
    void load();
  }, [load]);

  const problem = classFormProblem(gradeLevel, name);
  // Ein Hinweis erscheint erst, wenn schon etwas eingegeben ist; ein leeres Formular ist nur gesperrt.
  const hint = name !== '' || gradeLevel !== '' ? problem : undefined;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (problem !== undefined) {
      return;
    }
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const { data } = await apiClient.post<{ class: SchoolClass }>('/api/classes', {
        school_year_id: schoolYear.id,
        grade_level: Number(gradeLevel),
        name: name.trim()
      });
      setNotice(`Klasse ${data.class.name} angelegt.`);
      // Die Klassenstufe bleibt stehen: meist folgen weitere Klassen derselben Stufe (7a, 7b, ...).
      setName('');
    } catch (err) {
      setError(describeClassFailure(err));
    } finally {
      setBusy(false);
    }
    // Auch nach einem Fehler neu laden: die Liste kann sich inzwischen geaendert haben.
    await load();
  };

  /**
   * Fuehrt eine Aktion auf einer Klasse aus: Meldung bei Erfolg oder Fehler, danach immer neu laden (die Liste kann sich
   * inzwischen geaendert haben). Liefert, ob die Aktion gelang.
   */
  const run = async (action: ClassAction, request: () => Promise<unknown>, success: string): Promise<boolean> => {
    setBusy(true);
    setNotice(null);
    setError(null);
    let ok = false;
    try {
      await request();
      setNotice(success);
      ok = true;
    } catch (err) {
      setError(describeClassFailure(err, action));
    } finally {
      setBusy(false);
    }
    await load();
    return ok;
  };

  const save = async (target: SchoolClass, grade: number, newName: string) => {
    if (await run('update', () => apiClient.post(`/api/classes/${target.id}/update`, { grade_level: grade, name: newName }), `Klasse ${newName} gespeichert.`)) {
      setEditing(null);
    }
  };

  const remove = async (target: SchoolClass) => {
    setDeleting(null);
    if (await run('delete', () => apiClient.post(`/api/classes/${target.id}/delete`), `Klasse ${target.name} gelöscht.`) && editing?.id === target.id) {
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
                            onClick={() => void run('archive', () => apiClient.post(`/api/classes/${c.id}/archive`), `Klasse ${c.name} archiviert.`)}
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
                            onClick={() => void run('restore', () => apiClient.post(`/api/classes/${c.id}/restore`), `Klasse ${c.name} wiederhergestellt.`)}
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
