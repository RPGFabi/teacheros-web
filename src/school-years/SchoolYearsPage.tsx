import { useCallback, useState } from 'react';
import { Card, ConfirmDialog } from '@hoelzle/react-ui';
import type { AxiosInstance } from 'axios';
import type { SchoolYear } from '../shared/schoolYear';
import { useResource } from '../shared/useResource';
import SchoolYearDetail from './SchoolYearDetail';
import SchoolYearForm from './SchoolYearForm';
import SchoolYearList from './SchoolYearList';
import { describeSchoolYearFailure, type SchoolYearAction } from './schoolYears';

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
 * Seite „Schuljahre“ (Ticket #54): die Schuljahre der Schulinstanz nach Beginn mit Status ({@link SchoolYearList}) und, mit
 * `school_years.manage`, das Anlegen, Bearbeiten und Loeschen ({@link SchoolYearForm}, Ticket #56). Bezeichnung und Status
 * kommen fertig aus der API; die Bezeichnung ist nicht eingebbar, die Formulare zeigen nur eine Vorschau. Die API lehnt ab,
 * was nicht geht (Ueberschneidung, Schuljahr mit Klassen, Einwand eines anderen Moduls); die Seite uebersetzt die
 * Ablehnung. Ein Klick auf die Bezeichnung oeffnet die Detailansicht ({@link SchoolYearDetail}, Ticket #55). Die Seite
 * haelt den Zustand und die Schreibzugriffe, die drei Teile zeigen nur an.
 */
export default function SchoolYearsPage({ apiClient, canManage, canViewClasses = false, canManageClasses = false }: Props) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editing, setEditing] = useState<SchoolYear | null>(null);
  const [deleting, setDeleting] = useState<SchoolYear | null>(null);

  const fetchYears = useCallback(async () => (await apiClient.get<{ school_years: SchoolYear[] }>('/api/school-years')).data.school_years, [apiClient]);
  // Schreibzugriffe laden danach immer neu, auch nach einem Fehler: die Liste kann sich inzwischen geaendert haben.
  const { data: years, loadError, reload: load, busy, notice, error, run, clearMessages } = useResource<SchoolYear[], SchoolYearAction>(fetchYears, describeSchoolYearFailure);

  const detail = years?.find((year) => year.id === detailId);

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
    clearMessages();
    setEditing(year);
  };

  if (detail) {
    return (
      <SchoolYearDetail apiClient={apiClient} year={detail} canViewClasses={canViewClasses} canManageClasses={canManageClasses} onBack={() => setDetailId(null)} />
    );
  }

  return (
    <main className="content">
      <h1>Schuljahre</h1>
      {canManage && (
        <Card>
          <SchoolYearForm label="Schuljahr anlegen" submitText="Anlegen" busy={busy} clearOnSuccess onSubmit={create} />
        </Card>
      )}
      {canManage && editing && (
        <Card>
          <SchoolYearForm
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
      <SchoolYearList
        years={years}
        loadError={loadError}
        canManage={canManage}
        busy={busy}
        onReload={() => void load()}
        onOpen={(year) => setDetailId(year.id)}
        onEdit={startEditing}
        onDelete={setDeleting}
      />
    </main>
  );
}
