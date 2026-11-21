import { describeFailure, type FailureTexts } from '../api/errors';
import type { SchoolClass } from '../classes/classes';
import type { Subject } from '../subjects/subjects';

/**
 * Fachgruppe laut `GET /api/teaching-groups` (Ticket #64; Glossar: Fachgruppe): gehoert zu genau einem Schuljahr und genau
 * einem Fach und hat mindestens eine Klasse desselben Schuljahres (eine Menge, keine Hauptklasse). Eine nach dem Verknuepfen
 * archivierte Klasse bleibt darin, markiert mit `archived`.
 */
export interface TeachingGroup {
  id: string;
  name: string;
  school_year: { id: string; name: string };
  subject: Subject;
  classes: SchoolClass[];
}

/** Auswahl fuer das Anlegen-Formular laut `GET /api/teaching-groups/choices`: waehlbare Faecher und Klassen des Schuljahres. */
export interface TeachingGroupChoices {
  subjects: Subject[];
  classes: SchoolClass[];
}

export const MAX_NAME_LENGTH = 40;

/**
 * Hinweis zu den Eingaben des Anlegen-Formulars oder `undefined`, wenn sie passen. Wie in der API: Bezeichnung nach dem
 * Trimmen 1 bis 40 Zeichen, ein Fach und mindestens eine Klasse. Die API bleibt massgeblich.
 */
export function teachingGroupFormProblem(name: string, subjectId: string, classIds: string[]): string | undefined {
  const length = [...name.trim()].length;
  if (length === 0) {
    return 'Bitte geben Sie eine Bezeichnung an.';
  }
  if (length > MAX_NAME_LENGTH) {
    return `Die Bezeichnung darf höchstens ${MAX_NAME_LENGTH} Zeichen haben.`;
  }
  if (subjectId === '') {
    return 'Bitte wählen Sie ein Fach.';
  }
  if (classIds.length === 0) {
    return 'Bitte wählen Sie mindestens eine Klasse.';
  }
  return undefined;
}

/** Aktionen auf Fachgruppen; bestimmt den allgemeinen Fehlertext, wenn kein Code passt. */
export type TeachingGroupAction = 'create';

/** Texte fuer die Fehler der Fachgruppen-Aktionen (`{error, code}`). */
const FAILURE_TEXTS: FailureTexts<TeachingGroupAction> = {
  codes: {
    forbidden: 'Dafür fehlt Ihnen das Recht „Fachgruppen verwalten“.',
    teaching_group_name_taken: 'In diesem Schuljahr gibt es bereits eine Fachgruppe mit dieser Bezeichnung. Bezeichnungen sind je Schuljahr eindeutig, Groß- und Kleinschreibung zählt nicht.',
    subject_not_selectable: 'Das Fach gibt es nicht mehr oder es ist nicht wählbar. Bitte wählen Sie ein anderes Fach.',
    class_not_selectable: 'Mindestens eine Klasse gibt es nicht mehr, ist archiviert oder gehört nicht zu diesem Schuljahr. Bitte wählen Sie die Klassen neu.',
    school_year_not_found: 'Das Schuljahr gibt es nicht mehr. Bitte laden Sie die Seite neu.',
    invalid_request: `Bitte geben Sie eine Bezeichnung mit 1 bis ${MAX_NAME_LENGTH} Zeichen an und wählen Sie ein Fach und mindestens eine Klasse.`
  },
  fallback: {
    create: 'Die Fachgruppe konnte nicht angelegt werden. Bitte versuchen Sie es erneut.'
  }
};

/** Text zu einer abgelehnten Anfrage auf Fachgruppen. */
export function describeTeachingGroupFailure(err: unknown, action: TeachingGroupAction = 'create'): string {
  return describeFailure(err, action, FAILURE_TEXTS);
}

/** Die Klassen fuer die Anzeige in einer Zeile: "7a, 7b"; eine nach dem Verknuepfen archivierte Klasse ist als „(archiviert)“ markiert. */
export function classNames(classes: SchoolClass[]): string {
  return classes.map((c) => (c.archived ? `${c.name} (archiviert)` : c.name)).join(', ');
}
