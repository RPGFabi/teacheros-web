import { errorCode } from '../api/errors';
import type { SchoolYear } from '../school-years/schoolYears';

/** Klasse laut `GET /api/classes` (Ticket #55); gehoert unveraenderlich zu genau einem Schuljahr (Glossar: Klasse). */
export interface SchoolClass {
  id: string;
  /** Klassenstufe (Glossar), 1 bis 13; wird bei der Klasse festgehalten, nie aus der Bezeichnung gelesen. */
  grade_level: number;
  name: string;
  school_year: { id: string; name: string };
}

export const MIN_GRADE_LEVEL = 1;
export const MAX_GRADE_LEVEL = 13;
export const MAX_NAME_LENGTH = 20;

/**
 * Vorausgewaehltes Schuljahr der Seite „Klassen“: das laufende, sonst das zuletzt vergangene. Das ist dieselbe Regel wie der
 * Status der API (laufend ist auch das naechste kommende, wenn heute in einer Luecke liegt); hier wird nur der fertige
 * Status gelesen, nichts aus Daten berechnet. `years` kommt nach Beginn aufsteigend. Ohne beides gibt es keine Vorauswahl.
 */
export function defaultSchoolYear<T extends Pick<SchoolYear, 'status'>>(years: T[]): T | undefined {
  return years.find((y) => y.status === 'running') ?? [...years].reverse().find((y) => y.status === 'past');
}

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

/** Verstaendliche Texte fuer die Fehlercodes beim Anlegen (`{error, code}`). */
const ERROR_TEXT: Record<string, string> = {
  forbidden: 'Dafür fehlt Ihnen das Recht „Klassen verwalten“.',
  class_name_taken: 'In diesem Schuljahr gibt es bereits eine Klasse mit dieser Bezeichnung. Bezeichnungen sind je Schuljahr eindeutig, Groß- und Kleinschreibung zählt nicht.',
  school_year_not_found: 'Das Schuljahr gibt es nicht mehr. Bitte laden Sie die Seite neu.',
  invalid_request: `Bitte geben Sie die Klassenstufe (${MIN_GRADE_LEVEL} bis ${MAX_GRADE_LEVEL}) und eine Bezeichnung mit 1 bis ${MAX_NAME_LENGTH} Zeichen an.`
};

export function describeClassFailure(err: unknown): string {
  const code = errorCode(err);
  return (code !== undefined && ERROR_TEXT[code]) || 'Die Klasse konnte nicht angelegt werden. Bitte versuchen Sie es erneut.';
}
