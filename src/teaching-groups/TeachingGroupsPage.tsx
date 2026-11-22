import { useCallback, useState } from 'react';
import { Button, Card, FormField, Select } from '@hoelzle/react-ui';
import type { AxiosInstance } from 'axios';
import { defaultSchoolYear, statusLabel, type SchoolYear } from '../shared/schoolYear';
import { useResource } from '../shared/useResource';
import TeachingGroupDetail from './TeachingGroupDetail';
import TeachingGroupsPanel from './TeachingGroupsPanel';

interface Props {
  apiClient: AxiosInstance;
  /** Recht `teaching_groups.manage` aus GET /api/me; ohne es gibt es kein Anlegen-Formular. */
  canManage: boolean;
  /** Recht `teacher_assignments.manage` (Ticket #67): Lehrkräfte in der Detailansicht zuordnen, beenden, löschen. Standard: nein. */
  canManageAssignments?: boolean;
}

/**
 * Seite „Fachgruppen“ (Ticket #64): Schuljahr waehlen, vorausgewaehlt wie bei den Klassen das laufende, sonst das zuletzt
 * vergangene, sonst das naechste kommende, und die Fachgruppen dieses Schuljahres sehen, mit `teaching_groups.manage`
 * anlegen und in einer Detailansicht mit ihren Klassen oeffnen. Nutzbar mit nur `teaching_groups.view`: Schuljahre, Faecher
 * und Klassen kommen von den Endpunkten der Fachgruppen, nicht von denen der Schuljahre, Faecher und Klassen.
 */
export default function TeachingGroupsPage({ apiClient, canManage, canManageAssignments = false }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  const fetchYears = useCallback(async () => {
    const { data } = await apiClient.get<{ school_years: SchoolYear[] }>('/api/teaching-groups/school-years');
    setSelectedId((current) => current ?? defaultSchoolYear(data.school_years)?.id ?? null);
    return data.school_years;
  }, [apiClient]);
  const { data: years, loadError, reload: load } = useResource(fetchYears);

  const selected = years?.find((y) => y.id === selectedId);

  if (openGroupId !== null) {
    return <TeachingGroupDetail key={openGroupId} apiClient={apiClient} id={openGroupId} canManageAssignments={canManageAssignments} onBack={() => setOpenGroupId(null)} />;
  }

  return (
    <main className="content">
      <h1>Fachgruppen</h1>
      {loadError && (
        <Card>
          <p role="alert">Die Schuljahre konnten nicht geladen werden.</p>
          <Button variant="secondary" onClick={() => void load()}>Erneut laden</Button>
        </Card>
      )}
      {!loadError && years === null && <p>Schuljahre werden geladen …</p>}
      {!loadError && years !== null && years.length === 0 && (
        <Card>
          <p>Es gibt noch kein Schuljahr. Fachgruppen gehören zu einem Schuljahr und lassen sich erst anlegen, wenn es eines gibt.</p>
        </Card>
      )}
      {!loadError && years !== null && years.length > 0 && (
        <>
          <Card>
            <FormField label="Schuljahr" htmlFor="teaching-groups-school-year">
              <Select
                id="teaching-groups-school-year"
                value={selectedId ?? ''}
                placeholder={selected ? undefined : 'Schuljahr wählen'}
                options={years.map((y) => ({ value: y.id, label: `${y.name} (${statusLabel(y.status)})` }))}
                onChange={(e) => setSelectedId(e.target.value)}
              />
            </FormField>
          </Card>
          {selected && <TeachingGroupsPanel key={selected.id} apiClient={apiClient} schoolYear={selected} canManage={canManage} onOpen={setOpenGroupId} />}
        </>
      )}
    </main>
  );
}
