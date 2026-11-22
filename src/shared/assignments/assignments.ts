import { describeFailure, type FailureTexts } from '../../api/errors';
import { formatDay } from '../format';

/**
 * Was Lehrkraft-Zuordnungen zu Fachgruppen (Ticket #67) und Klassenleitungen (Ticket #68; Glossar: Lehrkraft-Zuordnung,
 * Klassenleitung, Gueltigkeitszeitraum) gemeinsam haben: Typen, Anzeige, Pruefung des Formulars und die Fehlertexte, die fuer
 * beide gleich lauten. Was nur eine Art betrifft (Endpunkt, Woerter), steht in ihrer {@link AssignmentConfig}.
 */

/** Lehrkraft in den Ausgaben bestehender Zuordnungen: nur Kennung des Kontos und Anmeldename (Datensparsamkeit), weder E-Mail noch Kontostatus. */
export interface TeacherRef {
  id: string;
  login_name: string;
}

/** Waehlbare Lehrkraft laut `GET /api/teacher-assignments/teachers` (Recht `teacher_assignments.manage`): ein Konto mit der Standardrolle Lehrkraft. */
export interface Teacher extends TeacherRef {
  email: string | null;
  /** Kontostatus: `invited` oder `active`. */
  status: string;
}

/** Status einer Zuordnung laut API: aus dem heutigen Datum abgeleitet, nie gespeichert. */
export type AssignmentStatus = 'upcoming' | 'running' | 'ended';

/**
 * Eine Zuordnung laut `GET …?<Elternobjekt>_id=…`. `starts_on` ist der erste, `ends_on` der letzte Tag (einschliesslich), `null`
 * heisst offen, also bis zum Ende des Schuljahres; `last_day` ist dann dieses Schuljahresende. Die Kennung des Elternobjekts
 * (`teaching_group_id`, `class_id`) braucht die Anzeige nicht.
 */
export interface Assignment {
  id: string;
  teacher: TeacherRef;
  starts_on: string;
  ends_on: string | null;
  last_day: string;
  status: AssignmentStatus | string;
}

/** Aktionen auf Zuordnungen; bestimmt den allgemeinen Fehlertext, wenn kein Code passt. */
export type AssignmentAction = 'create' | 'end' | 'delete';

/** Die Woerter einer Art von Zuordnung fuer den Abschnitt (Ueberschrift, Hinweise, Meldungen). */
export interface AssignmentTexts {
  heading: string;
  loading: string;
  empty: string;
  loadError: string;
  /** Hinweis, wenn das Elternobjekt archiviert ist: ihm wird nichts neu zugeordnet. */
  archivedNotice: string;
  /** Name des Formulars zum Zuordnen (zugleich seine Ueberschrift). */
  createForm: string;
  /** Erklaerung unter dem Formular zum Zuordnen. */
  createHelp: string;
  /** Erfolgsmeldung; `login` ist der Anmeldename der gewaehlten Lehrkraft, falls bekannt. */
  created: (login: string | undefined) => string;
  endForm: string;
  endTitle: (login: string) => string;
  endHelp: string;
  ended: (login: string) => string;
  deleteTitle: (login: string) => string;
  deleteDescription: (validity: string) => string;
  deleted: (login: string) => string;
}

/** Eine Art von Zuordnung: wohin die Anfragen gehen und welche Woerter der Abschnitt verwendet. */
export interface AssignmentConfig {
  /** Endpunkt der Zuordnungen, z. B. `/api/class-leaders` (daran haengen `/:id/end` und `/:id/delete`). */
  endpoint: string;
  /** Schluessel des Elternobjekts in Query und Body, z. B. `class_id`. */
  parentKey: string;
  /** Schluessel der Liste in der Antwort, z. B. `class_leaders`. */
  listKey: string;
  texts: AssignmentTexts;
  failure: FailureTexts<AssignmentAction>;
}

/** Endpunkt der waehlbaren Lehrkraefte, fuer beide Arten derselbe (Recht `teacher_assignments.manage`). */
export const TEACHERS_ENDPOINT = '/api/teacher-assignments/teachers';

const STATUS_LABELS: Record<AssignmentStatus, string> = { upcoming: 'kommend', running: 'laufend', ended: 'beendet' };

/** Anzeigename des Status einer Zuordnung. */
export function statusLabel(status: string): string {
  return Object.prototype.hasOwnProperty.call(STATUS_LABELS, status) ? STATUS_LABELS[status as AssignmentStatus] : status;
}

/** Der Gueltigkeitszeitraum fuer die Anzeige; ein offenes Ende nennt das Schuljahresende, bis zu dem die Zuordnung gilt. */
export function validityText(assignment: Pick<Assignment, 'starts_on' | 'ends_on' | 'last_day'>): string {
  return assignment.ends_on === null
    ? `ab ${formatDay(assignment.starts_on)}, offen (bis Schuljahresende ${formatDay(assignment.last_day)})`
    : `${formatDay(assignment.starts_on)} bis ${formatDay(assignment.ends_on)}`;
}

/** Beenden geht, solange die Zuordnung nicht beendet ist (die API entscheidet das Datum). */
export function canEnd(assignment: Pick<Assignment, 'status'>): boolean {
  return assignment.status !== 'ended';
}

/** Loeschen nur, was noch nie gegolten hat, also kommend ist (die API prueft es mit der Uhr der Schule). */
export function canDelete(assignment: Pick<Assignment, 'status'>): boolean {
  return assignment.status === 'upcoming';
}

/** Eintrag der Auswahl im Formular: Anmeldename, mit E-Mail, wenn bekannt (die Auswahl sehen nur Verwaltende). */
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

/**
 * Die Fehlertexte einer Art von Zuordnung: die Codes, deren Text fuer beide gleich lautet, plus die Woerter der Art
 * (`specific`, ueberschreibt) und je Aktion ein allgemeiner Text.
 */
export function assignmentFailureTexts(specific: Record<string, string>, fallback: Record<AssignmentAction, string>): FailureTexts<AssignmentAction> {
  return {
    codes: {
      forbidden: 'Dafür fehlt Ihnen das Recht „Lehrkraft-Zuordnungen verwalten“.',
      teacher_not_selectable: 'Das Konto ist keine wählbare Lehrkraft mehr: Es braucht die Rolle Lehrkraft und darf nicht deaktiviert sein. Bitte wählen Sie neu.',
      invalid_validity: 'Der Gültigkeitszeitraum passt nicht: Das Ende darf nicht vor dem Beginn liegen und muss beim Beenden vor dem bisherigen Ende liegen.',
      invalid_request: 'Bitte wählen Sie eine Lehrkraft und geben Sie Beginn und Ende als Kalendertag an.',
      ...specific
    },
    fallback
  };
}

/** Text zu einer abgelehnten Anfrage auf Zuordnungen einer Art. */
export function describeAssignmentFailure(config: Pick<AssignmentConfig, 'failure'>, err: unknown, action: AssignmentAction = 'create'): string {
  return describeFailure(err, action, config.failure);
}
