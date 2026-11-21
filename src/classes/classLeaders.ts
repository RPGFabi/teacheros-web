import { describeFailure, type FailureTexts } from '../api/errors';
import type { AssignmentStatus, Teacher } from '../teaching-groups/teacherAssignments';

/**
 * Klassenleitung laut `GET /api/class-leaders?class_id=…` (Ticket #68; Glossar: Klassenleitung, Gueltigkeitszeitraum). Gleiche
 * Form wie die Lehrkraft-Zuordnung zu einer Fachgruppe (Ticket #67), aber an der Klasse: `starts_on` ist der erste, `ends_on` der
 * letzte Tag (einschliesslich), `null` heisst offen, also bis zum Ende des Schuljahres; `last_day` ist dann dieses Schuljahresende.
 * Zeitraum, Status, Beenden und Loeschen behandelt `teaching-groups/teacherAssignments.ts` (`periodText`, `statusLabel`,
 * `canEnd`, `canDelete`, `assignmentFormProblem`, `teacherLabel`) fuer beide gleich.
 */
export interface ClassLeader {
  id: string;
  class_id: string;
  teacher: Teacher;
  starts_on: string;
  ends_on: string | null;
  last_day: string;
  status: AssignmentStatus | string;
}

/** Aktionen auf Klassenleitungen; bestimmt den allgemeinen Fehlertext, wenn kein Code passt. */
export type ClassLeaderAction = 'create' | 'end' | 'delete';

const FAILURE_TEXTS: FailureTexts<ClassLeaderAction> = {
  codes: {
    forbidden: 'Dafür fehlt Ihnen das Recht „Lehrkraft-Zuordnungen verwalten“.',
    class_not_found: 'Die Klasse gibt es nicht mehr. Bitte laden Sie die Seite neu.',
    class_archived: 'Die Klasse ist archiviert. Ihr lässt sich keine Klassenleitung neu zuordnen. Stellen Sie sie zuerst wieder her.',
    class_leader_not_found: 'Die Klassenleitung gibt es nicht mehr. Bitte laden Sie die Seite neu.',
    teacher_not_selectable: 'Das Konto ist keine wählbare Lehrkraft mehr: Es braucht die Rolle Lehrkraft und darf nicht deaktiviert sein. Bitte wählen Sie neu.',
    assignment_overlap: 'Die Lehrkraft ist an diesen Tagen schon Klassenleitung dieser Klasse. Gültigkeitszeiträume derselben Lehrkraft dürfen sich nicht überschneiden; nacheinander ist möglich.',
    assignment_limit_reached: 'An mindestens einem dieser Tage hat die Klasse schon so viele Klassenleitungen zugleich, wie die Schule erlaubt (Schuleinstellung „Klassenleitungen je Klasse“).',
    assignment_applied: 'Die Klassenleitung hat schon gegolten. Sie lässt sich nicht löschen oder rückwirkend kürzen, nur beenden: frühestens heute.',
    assignment_ended: 'Die Klassenleitung ist bereits beendet.',
    period_outside_school_year: 'Beginn und Ende müssen innerhalb des Schuljahres der Klasse liegen.',
    invalid_period: 'Der Gültigkeitszeitraum passt nicht: Das Ende darf nicht vor dem Beginn liegen und muss beim Beenden vor dem bisherigen Ende liegen.',
    invalid_request: 'Bitte wählen Sie eine Lehrkraft und geben Sie Beginn und Ende als Kalendertag an.'
  },
  fallback: {
    create: 'Die Klassenleitung konnte nicht angelegt werden. Bitte versuchen Sie es erneut.',
    end: 'Die Klassenleitung konnte nicht beendet werden. Bitte versuchen Sie es erneut.',
    delete: 'Die Klassenleitung konnte nicht gelöscht werden. Bitte versuchen Sie es erneut.'
  }
};

/** Text zu einer abgelehnten Anfrage auf Klassenleitungen. */
export function describeClassLeaderFailure(err: unknown, action: ClassLeaderAction = 'create'): string {
  return describeFailure(err, action, FAILURE_TEXTS);
}
