import { useCallback } from 'react';
import { Button, Card } from '@hoelzle/react-ui';
import type { AxiosInstance } from 'axios';
import { useResource } from '../shared/useResource';
import TeachingGroupForm from './TeachingGroupForm';
import { classNames, type TeachingGroup } from './teachingGroups';

interface Props {
  apiClient: AxiosInstance;
  schoolYear: { id: string; name: string };
  /** Recht `teaching_groups.manage` aus GET /api/me; ohne es gibt es kein Anlegen-Formular (die API verweigert es ohnehin). */
  canManage: boolean;
  /** Oeffnet die Detailansicht einer Fachgruppe (Kennung). */
  onOpen: (id: string) => void;
}

/**
 * Die Fachgruppen eines Schuljahres (Ticket #64): Liste in der Reihenfolge der API (nach Fachkuerzel, dann natuerlich nach
 * Bezeichnung) mit Fach und Klassen, dazu mit `teaching_groups.manage` das Anlegen-Formular. Die Tabelle wird auf dem
 * Smartphone per CSS zu Karten (`data-label` je Zelle). Beim Wechsel des Schuljahres neu mounten (`key`), dann beginnen
 * Eingaben und Meldungen frisch.
 */
export default function TeachingGroupsPanel({ apiClient, schoolYear, canManage, onOpen }: Props) {
  const fetchGroups = useCallback(
    async () => (await apiClient.get<{ teaching_groups: TeachingGroup[] }>('/api/teaching-groups', { params: { school_year_id: schoolYear.id } })).data.teaching_groups,
    [apiClient, schoolYear.id]
  );
  const { data: groups, loadError, reload: load } = useResource(fetchGroups);

  return (
    <>
      {canManage && <TeachingGroupForm apiClient={apiClient} schoolYear={schoolYear} onChanged={load} />}
      <Card>
        {loadError && (
          <>
            <p role="alert">Die Fachgruppen konnten nicht geladen werden.</p>
            <Button variant="secondary" onClick={() => void load()}>Erneut laden</Button>
          </>
        )}
        {!loadError && groups === null && <p>Fachgruppen werden geladen …</p>}
        {!loadError && groups !== null && groups.length === 0 && <p>In diesem Schuljahr gibt es noch keine Fachgruppe.</p>}
        {!loadError && groups !== null && groups.length > 0 && (
          <table className="responsive-table">
            <thead>
              <tr>
                <th scope="col">Fachgruppe</th>
                <th scope="col">Fach</th>
                <th scope="col">Klassen</th>
                <th scope="col">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id}>
                  <th scope="row">{g.name}</th>
                  <td data-label="Fach">{g.subject.code}</td>
                  <td data-label="Klassen">{classNames(g.classes)}</td>
                  <td data-label="Aktionen">
                    <Button variant="secondary" aria-label={`Details: ${g.name}`} onClick={() => onOpen(g.id)}>Details</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
