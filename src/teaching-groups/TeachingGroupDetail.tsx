import { useCallback } from 'react';
import { Button, Card, Chip } from '@hoelzle/react-ui';
import type { AxiosInstance } from 'axios';
import { useResource } from '../shared/useResource';
import AssignmentSection from '../shared/assignments/AssignmentSection';
import { TEACHER_ASSIGNMENTS } from './teacherAssignments';
import type { TeachingGroup } from './teachingGroups';

interface Props {
  apiClient: AxiosInstance;
  id: string;
  /** Recht `teacher_assignments.manage` aus GET /api/me; ohne es zeigt der Abschnitt „Lehrkräfte“ nur die Zuordnungen. */
  canManageAssignments: boolean;
  onBack: () => void;
}

/**
 * Detailansicht einer Fachgruppe (Ticket #64): Schuljahr, Fach und die Klassen der Fachgruppe (eine Menge, keine Hauptklasse),
 * dazu der Abschnitt „Lehrkräfte“ mit den Lehrkraft-Zuordnungen (Ticket #67).
 */
export default function TeachingGroupDetail({ apiClient, id, canManageAssignments, onBack }: Props) {
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
          <AssignmentSection apiClient={apiClient} config={TEACHER_ASSIGNMENTS} parentId={group.id} canManage={canManageAssignments} archived={group.archived} />
        </>
      )}
    </main>
  );
}
