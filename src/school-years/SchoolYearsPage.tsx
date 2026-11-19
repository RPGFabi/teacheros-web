import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button, Card, Chip, FormField, TextInput } from '@hoelzle/react-ui';
import type { AxiosInstance } from 'axios';
import { describeSchoolYearFailure, formatDay, previewName, statusLabel, statusVariant, type SchoolYear } from './schoolYears';

interface Props {
  apiClient: AxiosInstance;
  /** Recht `school_years.manage` aus GET /api/me; ohne es gibt es kein Anlegen-Formular (die API verweigert es ohnehin). */
  canManage: boolean;
}

/**
 * Seite „Schuljahre“ (Ticket #54): die Schuljahre der Schulinstanz nach Beginn mit Status und, mit
 * `school_years.manage`, das Anlegen. Bezeichnung und Status kommen fertig aus der API; die Bezeichnung ist nicht
 * eingebbar, das Formular zeigt nur eine Vorschau. Die Tabelle wird auf dem Smartphone per CSS zu Karten
 * (`data-label` je Zelle).
 */
export default function SchoolYearsPage({ apiClient, canManage }: Props) {
  const [years, setYears] = useState<SchoolYear[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const response = await apiClient.get<{ school_years: SchoolYear[] }>('/api/school-years');
      setYears(response.data.school_years);
    } catch {
      setLoadError(true);
    }
  }, [apiClient]);

  useEffect(() => {
    void load();
  }, [load]);

  const preview = previewName(startsOn, endsOn);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const { data } = await apiClient.post<{ school_year: SchoolYear }>('/api/school-years', { starts_on: startsOn, ends_on: endsOn });
      setNotice(`Schuljahr ${data.school_year.name} angelegt.`);
      setStartsOn('');
      setEndsOn('');
    } catch (err) {
      setError(describeSchoolYearFailure(err));
    } finally {
      setBusy(false);
    }
    // Auch nach einem Fehler neu laden: die Liste kann sich inzwischen geaendert haben.
    await load();
  };

  return (
    <main className="content">
      <h1>Schuljahre</h1>
      {canManage && (
        <Card>
          <form aria-label="Schuljahr anlegen" onSubmit={(event) => void submit(event)}>
            <h2>Schuljahr anlegen</h2>
            <FormField label="Beginn" htmlFor="school-year-start">
              <TextInput id="school-year-start" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
            </FormField>
            <FormField label="Ende" htmlFor="school-year-end">
              <TextInput id="school-year-end" type="date" hasError={preview.problem !== undefined} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
            </FormField>
            <p>
              Beide Tage gehören zum Schuljahr. Das Ende muss im Kalenderjahr nach dem Beginn liegen; Schuljahre dürfen sich nicht überschneiden, Lücken dazwischen sind erlaubt.
              Die Bezeichnung ergibt sich aus dem Zeitraum.
            </p>
            <p aria-live="polite">
              {preview.name !== undefined && (
                <>
                  Bezeichnung: <output>{preview.name}</output>
                </>
              )}
              {preview.problem !== undefined && <span role="alert">{preview.problem}</span>}
            </p>
            <Button type="submit" disabled={busy || preview.name === undefined}>Anlegen</Button>
          </form>
        </Card>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      <Card>
        {loadError && (
          <>
            <p role="alert">Die Schuljahre konnten nicht geladen werden.</p>
            <Button variant="secondary" onClick={() => void load()}>Erneut laden</Button>
          </>
        )}
        {!loadError && years === null && <p>Schuljahre werden geladen …</p>}
        {!loadError && years !== null && years.length === 0 && <p>Es gibt noch kein Schuljahr.</p>}
        {!loadError && years !== null && years.length > 0 && (
          <table className="responsive-table">
            <thead>
              <tr>
                <th scope="col">Schuljahr</th>
                <th scope="col">Beginn</th>
                <th scope="col">Ende</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {years.map((year) => (
                <tr key={year.id}>
                  <th scope="row">{year.name}</th>
                  <td data-label="Beginn">{formatDay(year.starts_on)}</td>
                  <td data-label="Ende">{formatDay(year.ends_on)}</td>
                  <td data-label="Status">
                    <Chip variant={statusVariant(year.status)}>{statusLabel(year.status)}</Chip>
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
