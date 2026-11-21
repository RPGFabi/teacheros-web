import { useCallback, useState } from 'react';
import { Button, Card, FormField, Select } from '@hoelzle/react-ui';
import type { AxiosInstance } from 'axios';
import { defaultSchoolYear, statusLabel, type SchoolYear } from '../shared/schoolYear';
import { useResource } from '../shared/useResource';
import ClassDetail from './ClassDetail';
import ClassesPanel from './ClassesPanel';
import type { SchoolClass } from './classes';

interface Props {
  apiClient: AxiosInstance;
  /** Recht `classes.manage` aus GET /api/me; ohne es gibt es kein Anlegen-Formular. */
  canManage: boolean;
  /** Recht `teacher_assignments.manage` (Ticket #68): Klassenleitung in der Detailansicht zuordnen, beenden, löschen. Standard: nein. */
  canManageAssignments?: boolean;
}

/**
 * Seite „Klassen“ (Ticket #55): Schuljahr waehlen, vorausgewaehlt das laufende, sonst das zuletzt vergangene, sonst das naechste kommende, und die Klassen
 * dieses Schuljahres sehen und, mit `classes.manage`, anlegen. Nutzbar mit nur `classes.view`: die Schuljahre kommen von
 * `GET /api/classes/school-years`, nicht von der Schuljahr-Liste, die `school_years.view` braucht. Jede Klasse oeffnet eine
 * Detailansicht mit dem Abschnitt „Klassenleitung“ (Ticket #68).
 */
export default function ClassesPage({ apiClient, canManage, canManageAssignments = false }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openClass, setOpenClass] = useState<SchoolClass | null>(null);

  const fetchYears = useCallback(async () => {
    const { data } = await apiClient.get<{ school_years: SchoolYear[] }>('/api/classes/school-years');
    setSelectedId((current) => current ?? defaultSchoolYear(data.school_years)?.id ?? null);
    return data.school_years;
  }, [apiClient]);
  const { data: years, loadError, reload: load } = useResource(fetchYears);

  const selected = years?.find((y) => y.id === selectedId);

  if (openClass !== null) {
    return <ClassDetail key={openClass.id} apiClient={apiClient} schoolClass={openClass} canManageAssignments={canManageAssignments} onBack={() => setOpenClass(null)} />;
  }

  return (
    <main className="content">
      <h1>Klassen</h1>
      {loadError && (
        <Card>
          <p role="alert">Die Schuljahre konnten nicht geladen werden.</p>
          <Button variant="secondary" onClick={() => void load()}>Erneut laden</Button>
        </Card>
      )}
      {!loadError && years === null && <p>Schuljahre werden geladen …</p>}
      {!loadError && years !== null && years.length === 0 && (
        <Card>
          <p>Es gibt noch kein Schuljahr. Klassen gehören zu einem Schuljahr und lassen sich erst anlegen, wenn es eines gibt.</p>
        </Card>
      )}
      {!loadError && years !== null && years.length > 0 && (
        <>
          <Card>
            <FormField label="Schuljahr" htmlFor="classes-school-year">
              <Select
                id="classes-school-year"
                value={selectedId ?? ''}
                placeholder={selected ? undefined : 'Schuljahr wählen'}
                options={years.map((y) => ({ value: y.id, label: `${y.name} (${statusLabel(y.status)})` }))}
                onChange={(e) => setSelectedId(e.target.value)}
              />
            </FormField>
          </Card>
          {selected && <ClassesPanel key={selected.id} apiClient={apiClient} schoolYear={selected} canManage={canManage} onOpen={setOpenClass} />}
        </>
      )}
    </main>
  );
}
