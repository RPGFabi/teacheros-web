import { useCallback } from 'react';
import { Button, Card, Chip } from '@hoelzle/react-ui';
import type { AxiosInstance } from 'axios';
import { useResource } from '../shared/useResource';
import type { TeachingGroup } from './teachingGroups';

interface Props {
  apiClient: AxiosInstance;
  id: string;
  onBack: () => void;
}

/** Detailansicht einer Fachgruppe (Ticket #64): Schuljahr, Fach und die Klassen der Fachgruppe (eine Menge, keine Hauptklasse). */
export default function TeachingGroupDetail({ apiClient, id, onBack }: Props) {
  const fetchGroup = useCallback(async () => (await apiClient.get<{ teaching_group: TeachingGroup }>(`/api/teaching-groups/${id}`)).data.teaching_group, [apiClient, id]);
  const { data: group, loadError, reload } = useResource(fetchGroup);

  return (
    <main className="content">
      <Button variant="secondary" onClick={onBack}>Zurück zu den Fachgruppen</Button>
      <h1>{group ? `Fachgruppe ${group.name}` : 'Fachgruppe'}</h1>
      {loadError && (
        <Card>
          <p role="alert">Die Fachgruppe konnte nicht geladen werden.</p>
          <Button variant="secondary" onClick={() => void reload()}>Erneut laden</Button>
        </Card>
      )}
      {!loadError && group === null && <p>Fachgruppe wird geladen …</p>}
      {!loadError && group !== null && (
        <>
          <Card>
            <dl>
              <dt>Schuljahr</dt>
              <dd>{group.school_year.name}</dd>
              <dt>Fach</dt>
              <dd>{group.subject.code} – {group.subject.name}</dd>
              {group.archived && (
                <>
                  <dt>Status</dt>
                  <dd>
                    <Chip variant="neutral">Archiviert</Chip>
                  </dd>
                </>
              )}
            </dl>
          </Card>
          <h2>Klassen</h2>
          <Card>
            <ul>
              {group.classes.map((c) => (
                <li key={c.id}>
                  {c.name} (Klassenstufe {c.grade_level}
                  {c.archived && (
                    <>
                      , <Chip variant="neutral">archiviert</Chip>
                    </>
                  )}
                  )
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </main>
  );
}
