import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button, Card, FormField, TextInput } from '@hoelzle/react-ui';
import type { AxiosInstance } from 'axios';
import { classFormProblem, describeClassFailure, MAX_GRADE_LEVEL, MIN_GRADE_LEVEL, type SchoolClass } from './classes';

interface Props {
  apiClient: AxiosInstance;
  schoolYear: { id: string; name: string };
  /** Recht `classes.manage` aus GET /api/me; ohne es gibt es kein Anlegen-Formular (die API verweigert es ohnehin). */
  canManage: boolean;
}

/**
 * Die Klassen eines Schuljahres (Ticket #55): Liste nach Klassenstufe und Bezeichnung in der Reihenfolge der API und, mit
 * `classes.manage`, das Anlegen. Gebraucht auf der Seite „Klassen“ und in der Detailansicht eines Schuljahres. Die
 * Tabelle wird auf dem Smartphone per CSS zu Karten (`data-label` je Zelle). Beim Wechsel des Schuljahres neu mounten
 * (`key`), dann beginnen Eingaben und Meldungen frisch.
 */
export default function ClassesPanel({ apiClient, schoolYear, canManage }: Props) {
  const [classes, setClasses] = useState<SchoolClass[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [gradeLevel, setGradeLevel] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const response = await apiClient.get<{ classes: SchoolClass[] }>('/api/classes', { params: { school_year_id: schoolYear.id } });
      setClasses(response.data.classes);
    } catch {
      setLoadError(true);
    }
  }, [apiClient, schoolYear.id]);

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

  return (
    <>
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
      <Card>
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
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.id}>
                  <th scope="row">{c.name}</th>
                  <td data-label="Klassenstufe">{c.grade_level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
