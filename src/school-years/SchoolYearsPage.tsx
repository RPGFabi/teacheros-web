import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { Button, Card, Chip, ConfirmDialog, FormField, TextInput } from '@hoelzle/react-ui';
import type { AxiosInstance } from 'axios';
import ClassesPanel from '../classes/ClassesPanel';
import { describeSchoolYearFailure, formatDay, previewName, statusLabel, statusVariant, type SchoolYear, type SchoolYearAction } from './schoolYears';

interface Props {
  apiClient: AxiosInstance;
  /** Recht `school_years.manage` aus GET /api/me; ohne es gibt es kein Anlegen, Bearbeiten und Loeschen (die API verweigert es ohnehin). */
  canManage: boolean;
  /** Recht `classes.view` aus GET /api/me; ohne es zeigt die Detailansicht keine Klassen. */
  canViewClasses?: boolean;
  /** Recht `classes.manage` aus GET /api/me; ohne es gibt es in der Detailansicht kein Klasse-anlegen-Formular. */
  canManageClasses?: boolean;
}

/**
 * Seite „Schuljahre“ (Ticket #54): die Schuljahre der Schulinstanz nach Beginn mit Status und, mit
 * `school_years.manage`, das Anlegen, Bearbeiten und Loeschen (Ticket #56). Bezeichnung und Status kommen fertig aus der
 * API; die Bezeichnung ist nicht eingebbar, die Formulare zeigen nur eine Vorschau. Die API lehnt ab, was nicht geht
 * (Ueberschneidung, Schuljahr mit Klassen, Einwand eines anderen Moduls); die Seite uebersetzt die Ablehnung. Die Tabelle
 * wird auf dem Smartphone per CSS zu Karten (`data-label` je Zelle). Ein Klick auf die Bezeichnung oeffnet die
 * Detailansicht (Ticket #55): Zeitraum, Status und die Klassen des Schuljahres.
 */
export default function SchoolYearsPage({ apiClient, canManage, canViewClasses = false, canManageClasses = false }: Props) {
  const [years, setYears] = useState<SchoolYear[] | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState<SchoolYear | null>(null);
  const [deleting, setDeleting] = useState<SchoolYear | null>(null);
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

  const detail = years?.find((year) => year.id === detailId);

  /** Schreibzugriff mit Meldung; true = gelungen. Auch nach einem Fehler neu laden: die Liste kann sich inzwischen geaendert haben. */
  const run = async (action: SchoolYearAction, write: () => Promise<string>): Promise<boolean> => {
    setBusy(true);
    setNotice(null);
    setError(null);
    let ok = false;
    try {
      setNotice(await write());
      ok = true;
    } catch (err) {
      setError(describeSchoolYearFailure(err, action));
    } finally {
      setBusy(false);
    }
    await load();
    return ok;
  };

  const create = (startsOn: string, endsOn: string) =>
    run('create', async () => {
      const { data } = await apiClient.post<{ school_year: SchoolYear }>('/api/school-years', { starts_on: startsOn, ends_on: endsOn });
      return `Schuljahr ${data.school_year.name} angelegt.`;
    });

  const update = async (year: SchoolYear, startsOn: string, endsOn: string) => {
    const ok = await run('update', async () => {
      const { data } = await apiClient.post<{ school_year: SchoolYear }>(`/api/school-years/${year.id}/update`, { starts_on: startsOn, ends_on: endsOn });
      return `Schuljahr ${data.school_year.name} gespeichert.`;
    });
    if (ok) {
      setEditing(null);
    }
    return ok;
  };

  const remove = (year: SchoolYear) => {
    setDeleting(null);
    return run('delete', async () => {
      await apiClient.post(`/api/school-years/${year.id}/delete`);
      return `Schuljahr ${year.name} gelöscht.`;
    });
  };

  const startEditing = (year: SchoolYear) => {
    setNotice(null);
    setError(null);
    setEditing(year);
  };

  if (detail) {
    return (
      <main className="content">
        <Button variant="secondary" onClick={() => setDetailId(null)}>Zurück zu den Schuljahren</Button>
        <h1>Schuljahr {detail.name}</h1>
        <Card>
          <dl>
            <dt>Beginn</dt>
            <dd>{formatDay(detail.starts_on)}</dd>
            <dt>Ende</dt>
            <dd>{formatDay(detail.ends_on)}</dd>
            <dt>Status</dt>
            <dd>
              <Chip variant={statusVariant(detail.status)}>{statusLabel(detail.status)}</Chip>
            </dd>
          </dl>
        </Card>
        <h2>Klassen</h2>
        {canViewClasses ? (
          <ClassesPanel key={detail.id} apiClient={apiClient} schoolYear={detail} canManage={canManageClasses} />
        ) : (
          <Card>
            <p>Zum Ansehen der Klassen fehlt Ihnen das Recht „Klassen ansehen“.</p>
          </Card>
        )}
      </main>
    );
  }

  return (
    <main className="content">
      <h1>Schuljahre</h1>
      {canManage && (
        <Card>
          <PeriodForm label="Schuljahr anlegen" submitText="Anlegen" busy={busy} clearOnSuccess onSubmit={create} />
        </Card>
      )}
      {canManage && editing && (
        <Card>
          <PeriodForm
            key={editing.id}
            label="Schuljahr bearbeiten"
            submitText="Speichern"
            initialStart={editing.starts_on}
            initialEnd={editing.ends_on}
            busy={busy}
            onSubmit={(startsOn, endsOn) => update(editing, startsOn, endsOn)}
            onCancel={() => setEditing(null)}
          />
        </Card>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      <ConfirmDialog
        open={deleting !== null}
        title={`Schuljahr „${deleting?.name ?? ''}“ löschen?`}
        description="Das Schuljahr wird endgültig gelöscht. Das lässt sich nicht rückgängig machen. Ein Schuljahr mit Klassen, auch archivierten, lässt sich nicht löschen."
        confirmText="Löschen"
        variant="danger"
        onConfirm={() => deleting && void remove(deleting)}
        onCancel={() => setDeleting(null)}
      />
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
                {canManage && <th scope="col">Aktionen</th>}
              </tr>
            </thead>
            <tbody>
              {years.map((year) => (
                <tr key={year.id}>
                  <th scope="row">
                    <button type="button" className="link-button" onClick={() => setDetailId(year.id)}>
                      {year.name}
                    </button>
                  </th>
                  <td data-label="Beginn">{formatDay(year.starts_on)}</td>
                  <td data-label="Ende">{formatDay(year.ends_on)}</td>
                  <td data-label="Status">
                    <Chip variant={statusVariant(year.status)}>{statusLabel(year.status)}</Chip>
                  </td>
                  {canManage && (
                    <td>
                      <Button variant="secondary" disabled={busy} aria-label={`Bearbeiten: ${year.name}`} onClick={() => startEditing(year)}>
                        Bearbeiten
                      </Button>{' '}
                      <Button variant="secondary" disabled={busy} aria-label={`Löschen: ${year.name}`} onClick={() => setDeleting(year)}>
                        Löschen
                      </Button>
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

interface PeriodFormProps {
  /** Name des Formulars (zugleich Ueberschrift): „Schuljahr anlegen“ oder „Schuljahr bearbeiten“. */
  label: string;
  submitText: string;
  initialStart?: string;
  initialEnd?: string;
  busy: boolean;
  /** Leert die Eingaben nach einem gelungenen Abschicken (Anlegen); beim Bearbeiten schliesst die Seite das Formular. */
  clearOnSuccess?: boolean;
  /** Liefert true, wenn die API den Zeitraum angenommen hat; bei einer Ablehnung bleiben die Eingaben stehen. */
  onSubmit: (startsOn: string, endsOn: string) => Promise<boolean>;
  onCancel?: () => void;
}

/** Beginn und Ende eines Schuljahres mit Vorschau der Bezeichnung; Anlegen und Bearbeiten haben dieselben Regeln. */
function PeriodForm({ label, submitText, initialStart = '', initialEnd = '', busy, clearOnSuccess = false, onSubmit, onCancel }: PeriodFormProps) {
  const id = useId();
  const [startsOn, setStartsOn] = useState(initialStart);
  const [endsOn, setEndsOn] = useState(initialEnd);
  const preview = previewName(startsOn, endsOn);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await onSubmit(startsOn, endsOn);
    if (ok && clearOnSuccess) {
      setStartsOn('');
      setEndsOn('');
    }
  };

  return (
    <form aria-label={label} onSubmit={(event) => void submit(event)}>
      <h2>{label}</h2>
      <FormField label="Beginn" htmlFor={`${id}-start`}>
        <TextInput id={`${id}-start`} type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
      </FormField>
      <FormField label="Ende" htmlFor={`${id}-end`}>
        <TextInput id={`${id}-end`} type="date" hasError={preview.problem !== undefined} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
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
      <Button type="submit" disabled={busy || preview.name === undefined}>{submitText}</Button>{' '}
      {onCancel && <Button variant="secondary" onClick={onCancel}>Abbrechen</Button>}
    </form>
  );
}
