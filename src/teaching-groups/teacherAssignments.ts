import { describeFailure, type FailureTexts } from '../api/errors';
import { formatDay } from '../shared/format';

/** Lehrkraft laut `GET /api/teacher-assignments/teachers` (Ticket #67; Glossar: Lehrkraft): ein Konto mit der Standardrolle Lehrkraft. */
export interface Teacher {
  id: string;
  login_name: string;
  email: string | null;
  /** Kontostatus: `invited`, `active` oder (bei bestehenden Zuordnungen) `inactive`. */
  status: string;
}

/** Status einer Zuordnung laut API: aus dem heutigen Datum abgeleitet, nie gespeichert. */
export type AssignmentStatus = 'upcoming' | 'running' | 'ended';

/**
 * Lehrkraft-Zuordnung zu einer Fachgruppe laut `GET /api/teacher-assignments?teaching_group_id=…` (Ticket #67; Glossar:
 * Lehrkraft-Zuordnung, Gueltigkeitszeitraum). `starts_on` ist der erste, `ends_on` der letzte Tag (einschliesslich), `null`
 * heisst offen, also bis zum Ende des Schuljahres; `last_day` ist dann dieses Schuljahresende.
 */
export interface TeacherAssignment {
  id: string;
  teaching_group_id: string;
  teacher: Teacher;
  starts_on: string;
  ends_on: string | null;
  last_day: string;
  status: AssignmentStatus | string;
}

/** Was der Zeitraum einer Zuordnung zeigt: gleich fuer Fachgruppen (#67) und Klassenleitungen (#68). */
export type AssignmentTerm = Pick<TeacherAssignment, 'starts_on' | 'ends_on' | 'last_day'>;

const STATUS_LABELS: Record<AssignmentStatus, string> = { upcoming: 'kommend', running: 'laufend', ended: 'beendet' };

/** Anzeigename des Status einer Zuordnung. */
export function statusLabel(status: string): string {
  return Object.prototype.hasOwnProperty.call(STATUS_LABELS, status) ? STATUS_LABELS[status as AssignmentStatus] : status;
}

/** Der Zeitraum fuer die Anzeige; ein offenes Ende nennt das Schuljahresende, bis zu dem die Zuordnung gilt. */
export function periodText(assignment: AssignmentTerm): string {
  return assignment.ends_on === null
    ? `ab ${formatDay(assignment.starts_on)}, offen (bis Schuljahresende ${formatDay(assignment.last_day)})`
    : `${formatDay(assignment.starts_on)} bis ${formatDay(assignment.ends_on)}`;
}

/** Beenden geht, solange die Zuordnung nicht beendet ist (die API entscheidet das Datum). */
export function canEnd(assignment: Pick<TeacherAssignment, 'status'>): boolean {
  return assignment.status !== 'ended';
}

/** Loeschen nur, was noch nie gegolten hat, also kommend ist (die API prueft es mit der Uhr der Schule). */
export function canDelete(assignment: Pick<TeacherAssignment, 'status'>): boolean {
  return assignment.status === 'upcoming';
}

/** Anmeldename der Lehrkraft, mit E-Mail, wenn bekannt. */
export function teacherLabel(teacher: Teacher): string {
  return teacher.email ? `${teacher.login_name} (${teacher.email})` : teacher.login_name;
}

/**
 * Hinweis zu den Eingaben des Formulars oder `undefined`, wenn sie passen: eine Lehrkraft ist Pflicht, Beginn und Ende duerfen
 * fehlen (Beginn: erster Tag des Schuljahres, Ende: offen), das Ende liegt nicht vor dem Beginn. Ob die Tage im Schuljahr
 * liegen und die Zuordnung zulaessig ist, entscheidet die API.
 */
export function assignmentFormProblem(teacherId: string, startsOn: string, endsOn: string): string | undefined {
  if (teacherId === '') {
    return 'Bitte wählen Sie eine Lehrkraft.';
  }
  if (startsOn !== '' && endsOn !== '' && endsOn < startsOn) {
    return 'Das Ende darf nicht vor dem Beginn liegen.';
  }
  return undefined;
}

/** Aktionen auf Zuordnungen; bestimmt den allgemeinen Fehlertext, wenn kein Code passt. */
export type TeacherAssignmentAction = 'create' | 'end' | 'delete';

const FAILURE_TEXTS: FailureTexts<TeacherAssignmentAction> = {
  codes: {
    forbidden: 'Dafür fehlt Ihnen das Recht „Lehrkraft-Zuordnungen verwalten“.',
    teaching_group_not_found: 'Die Fachgruppe gibt es nicht mehr. Bitte laden Sie die Seite neu.',
    teaching_group_archived: 'Die Fachgruppe ist archiviert. Ihr lassen sich keine Lehrkräfte neu zuordnen. Stellen Sie sie zuerst wieder her.',
    teacher_assignment_not_found: 'Die Zuordnung gibt es nicht mehr. Bitte laden Sie die Seite neu.',
    teacher_not_selectable: 'Das Konto ist keine wählbare Lehrkraft mehr: Es braucht die Rolle Lehrkraft und darf nicht deaktiviert sein. Bitte wählen Sie neu.',
    assignment_overlap: 'Die Lehrkraft ist an diesen Tagen schon dieser Fachgruppe zugeordnet. Gültigkeitszeiträume derselben Lehrkraft dürfen sich nicht überschneiden; nacheinander ist möglich.',
    assignment_limit_reached: 'An mindestens einem dieser Tage sind schon so viele Lehrkräfte zugleich zugeordnet, wie die Schule erlaubt (Schuleinstellung „Lehrkräfte je Fachgruppe“).',
    assignment_applied: 'Die Zuordnung hat schon gegolten. Sie lässt sich nicht löschen oder rückwirkend kürzen, nur beenden: frühestens heute.',
    assignment_ended: 'Die Zuordnung ist bereits beendet.',
    period_outside_school_year: 'Beginn und Ende müssen innerhalb des Schuljahres der Fachgruppe liegen.',
    invalid_period: 'Der Gültigkeitszeitraum passt nicht: Das Ende darf nicht vor dem Beginn liegen und muss beim Beenden vor dem bisherigen Ende liegen.',
    invalid_request: 'Bitte wählen Sie eine Lehrkraft und geben Sie Beginn und Ende als Kalendertag an.'
  },
  fallback: {
    create: 'Die Zuordnung konnte nicht angelegt werden. Bitte versuchen Sie es erneut.',
    end: 'Die Zuordnung konnte nicht beendet werden. Bitte versuchen Sie es erneut.',
    delete: 'Die Zuordnung konnte nicht gelöscht werden. Bitte versuchen Sie es erneut.'
  }
};

/** Text zu einer abgelehnten Anfrage auf Zuordnungen. */
export function describeTeacherAssignmentFailure(err: unknown, action: TeacherAssignmentAction = 'create'): string {
  return describeFailure(err, action, FAILURE_TEXTS);
}
