import { useCallback, useEffect, useState } from 'react';
import { Button, Card, FormField, Select } from '@hoelzle/react-ui';
import type { AxiosInstance } from 'axios';
import { statusLabel, type SchoolYear } from '../school-years/schoolYears';
import ClassesPanel from './ClassesPanel';
import { defaultSchoolYear } from './classes';

interface Props {
  apiClient: AxiosInstance;
  /** Recht `classes.manage` aus GET /api/me; ohne es gibt es kein Anlegen-Formular. */
  canManage: boolean;
}

/**
 * Seite „Klassen“ (Ticket #55): Schuljahr waehlen, vorausgewaehlt das laufende, sonst das zuletzt vergangene, und die Klassen
 * dieses Schuljahres sehen und, mit `classes.manage`, anlegen. Nutzbar mit nur `classes.view`: die Schuljahre kommen von
 * `GET /api/classes/school-years`, nicht von der Schuljahr-Liste, die `school_years.view` braucht.
 */
export default function ClassesPage({ apiClient, canManage }: Props) {
  const [years, setYears] = useState<SchoolYear[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const response = await apiClient.get<{ school_years: SchoolYear[] }>('/api/classes/school-years');
      setYears(response.data.school_years);
      setSelectedId((current) => current ?? defaultSchoolYear(response.data.school_years)?.id ?? null);
    } catch {
      setLoadError(true);
    }
  }, [apiClient]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = years?.find((y) => y.id === selectedId);

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
          {selected && <ClassesPanel key={selected.id} apiClient={apiClient} schoolYear={selected} canManage={canManage} />}
        </>
      )}
    </main>
  );
}
