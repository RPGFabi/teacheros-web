import { useCallback, useState, type FormEvent } from 'react';
import { Button, Card, FormField, TextInput } from '@hoelzle/react-ui';
import type { AxiosInstance } from 'axios';
import { useResource } from '../shared/useResource';
import { describeSubjectFailure, MAX_CODE_LENGTH, MAX_NAME_LENGTH, subjectFormProblem, type Subject, type SubjectAction } from './subjects';

interface Props {
  apiClient: AxiosInstance;
  /** Recht `subjects.manage` aus GET /api/me; ohne es gibt es kein Anlegen-Formular (die API verweigert es ohnehin). */
  canManage: boolean;
}

/**
 * Seite „Fächer“ (Ticket #62): die Faecher der Schulinstanz in der Reihenfolge der API (natuerlich nach Kuerzel) und, mit
 * `subjects.manage`, das Anlegen mit Kuerzel und Bezeichnung. Ein Fach gilt unabhaengig vom Schuljahr. Die Tabelle wird auf dem
 * Smartphone per CSS zu Karten (`data-label` je Zelle).
 */
export default function SubjectsPage({ apiClient, canManage }: Props) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');

  const fetchSubjects = useCallback(async () => (await apiClient.get<{ subjects: Subject[] }>('/api/subjects')).data.subjects, [apiClient]);
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

  return (
    <main className="content">
      <h1>Fächer</h1>
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
      <Card>
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
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.id}>
                  <th scope="row">{s.code}</th>
                  <td data-label="Bezeichnung">{s.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </main>
  );
}
