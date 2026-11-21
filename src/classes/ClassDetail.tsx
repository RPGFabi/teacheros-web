import type { AxiosInstance } from 'axios';
import { Button, Card, Chip } from '@hoelzle/react-ui';
import ClassLeadersSection from './ClassLeadersSection';
import type { SchoolClass } from './classes';

interface Props {
  apiClient: AxiosInstance;
  /** Die Klasse, wie die Liste sie zeigt (`GET /api/classes`); es gibt keinen eigenen Endpunkt fuer eine einzelne Klasse. */
  schoolClass: SchoolClass;
  /** Recht `teacher_assignments.manage` aus GET /api/me; ohne es zeigt der Abschnitt „Klassenleitung“ nur die Klassenleitungen. */
  canManageAssignments: boolean;
  onBack: () => void;
}

/** Detailansicht einer Klasse (Ticket #68): Schuljahr, Klassenstufe und der Abschnitt „Klassenleitung“. */
export default function ClassDetail({ apiClient, schoolClass, canManageAssignments, onBack }: Props) {
  return (
    <main className="content">
      <Button variant="secondary" onClick={onBack}>Zurück zu den Klassen</Button>
      <h1>Klasse {schoolClass.name}</h1>
      <Card>
        <dl>
          <dt>Schuljahr</dt>
          <dd>{schoolClass.school_year.name}</dd>
          <dt>Klassenstufe</dt>
          <dd>{schoolClass.grade_level}</dd>
          {schoolClass.archived && (
            <>
              <dt>Status</dt>
              <dd>
                <Chip variant="neutral">Archiviert</Chip>
              </dd>
            </>
          )}
        </dl>
      </Card>
      <ClassLeadersSection apiClient={apiClient} classId={schoolClass.id} canManage={canManageAssignments} archived={schoolClass.archived} />
    </main>
  );
}
