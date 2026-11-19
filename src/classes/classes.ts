import { errorCode } from '../api/errors';

/**
 * Klasse laut `GET /api/classes` (Tickets #55, #57); gehoert unveraenderlich zu genau einem Schuljahr (Glossar: Klasse).
 * Eine archivierte Klasse (Glossar: Archivierung) bleibt lesbar, ist aber schreibgeschuetzt und nicht waehlbar.
 */
export interface SchoolClass {
  id: string;
  /** Klassenstufe (Glossar), 1 bis 13; wird bei der Klasse festgehalten, nie aus der Bezeichnung gelesen. */
  grade_level: number;
  name: string;
  archived: boolean;
  school_year: { id: string; name: string };
}

export const MIN_GRADE_LEVEL = 1;
export const MAX_GRADE_LEVEL = 13;
export const MAX_NAME_LENGTH = 20;

/**
 * Hinweis zu den Eingaben des Anlegen-Formulars oder `undefined`, wenn sie passen. Wie in der API: Klassenstufe ganze
 * Zahl von 1 bis 13, Bezeichnung nach dem Trimmen 1 bis 20 Zeichen; die Bezeichnung wird nicht gegen die Klassenstufe
 * geprueft. Die API bleibt massgeblich.
 */
export function classFormProblem(gradeLevel: string, name: string): string | undefined {
  const grade = Number(gradeLevel);
  if (gradeLevel.trim() === '' || !Number.isInteger(grade) || grade < MIN_GRADE_LEVEL || grade > MAX_GRADE_LEVEL) {
    return `Die Klassenstufe muss eine ganze Zahl von ${MIN_GRADE_LEVEL} bis ${MAX_GRADE_LEVEL} sein.`;
  }
  const length = [...name.trim()].length;
  if (length === 0) {
    return 'Bitte geben Sie eine Bezeichnung an.';
  }
  if (length > MAX_NAME_LENGTH) {
    return `Die Bezeichnung darf höchstens ${MAX_NAME_LENGTH} Zeichen haben.`;
  }
  return undefined;
}

/** Aktionen auf einer Klasse; bestimmt den allgemeinen Fehlertext, wenn kein Code passt. */
export type ClassAction = 'create' | 'update' | 'archive' | 'restore' | 'delete';

const FALLBACK_TEXT: Record<ClassAction, string> = {
  create: 'Die Klasse konnte nicht angelegt werden. Bitte versuchen Sie es erneut.',
  update: 'Die Klasse konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.',
  archive: 'Die Klasse konnte nicht archiviert werden. Bitte versuchen Sie es erneut.',
  restore: 'Die Klasse konnte nicht wiederhergestellt werden. Bitte versuchen Sie es erneut.',
  delete: 'Die Klasse konnte nicht gelöscht werden. Bitte versuchen Sie es erneut.'
};

/** Verstaendliche Texte fuer die Fehlercodes der Klassen-Aktionen (`{error, code}`). */
const ERROR_TEXT: Record<string, string> = {
  forbidden: 'Dafür fehlt Ihnen das Recht „Klassen verwalten“.',
  class_name_taken: 'In diesem Schuljahr gibt es bereits eine Klasse mit dieser Bezeichnung. Bezeichnungen sind je Schuljahr eindeutig, Groß- und Kleinschreibung zählt nicht.',
  school_year_not_found: 'Das Schuljahr gibt es nicht mehr. Bitte laden Sie die Seite neu.',
  invalid_request: `Bitte geben Sie die Klassenstufe (${MIN_GRADE_LEVEL} bis ${MAX_GRADE_LEVEL}) und eine Bezeichnung mit 1 bis ${MAX_NAME_LENGTH} Zeichen an.`,
  class_not_found: 'Die Klasse gibt es nicht mehr. Die Liste wurde neu geladen.',
  class_archived: 'Die Klasse ist archiviert und lässt sich nicht ändern. Stellen Sie sie zuerst wieder her.',
  class_already_archived: 'Die Klasse ist bereits archiviert.',
  class_not_archived: 'Die Klasse ist nicht archiviert.',
  class_linked: 'Die Klasse ist verknüpft und lässt sich nicht löschen. Archivieren Sie sie stattdessen: Sie bleibt lesbar, ist aber nicht mehr wählbar.'
};

export function describeClassFailure(err: unknown, action: ClassAction = 'create'): string {
  const code = errorCode(err);
  return (code !== undefined && ERROR_TEXT[code]) || FALLBACK_TEXT[action];
}
