import { describeFailure, type FailureTexts } from '../api/errors';

/** Fach laut `GET /api/subjects` (Ticket #62); gilt fuer die ganze Schulinstanz, unabhaengig vom Schuljahr (Glossar: Fach). */
export interface Subject {
  id: string;
  /** Kuerzel: eindeutig ohne Gross-/Kleinschreibung und nach dem Anlegen unveraenderlich. */
  code: string;
  name: string;
}

export const MAX_CODE_LENGTH = 10;
export const MAX_NAME_LENGTH = 60;

/** Wie in der API: Buchstaben (auch Umlaute), Ziffern, "-" und "_", ohne Leerraum. */
const CODE_PATTERN = /^[\p{L}\p{Nd}_-]+$/u;

/**
 * Hinweis zu den Eingaben des Anlegen-Formulars oder `undefined`, wenn sie passen. Wie in der API: Kuerzel nach dem Trimmen
 * 1 bis 10 Zeichen aus Buchstaben, Ziffern, "-" und "_", Bezeichnung nach dem Trimmen 1 bis 60 Zeichen. Die API bleibt massgeblich.
 */
export function subjectFormProblem(code: string, name: string): string | undefined {
  const trimmedCode = code.trim();
  const codeLength = [...trimmedCode].length;
  if (codeLength === 0 || codeLength > MAX_CODE_LENGTH || !CODE_PATTERN.test(trimmedCode)) {
    return `Das Kürzel muss 1 bis ${MAX_CODE_LENGTH} Zeichen haben: nur Buchstaben, Ziffern, „-“ und „_“, ohne Leerzeichen.`;
  }
  const nameLength = [...name.trim()].length;
  if (nameLength === 0) {
    return 'Bitte geben Sie eine Bezeichnung an.';
  }
  if (nameLength > MAX_NAME_LENGTH) {
    return `Die Bezeichnung darf höchstens ${MAX_NAME_LENGTH} Zeichen haben.`;
  }
  return undefined;
}

/** Aktionen auf Faechern; bestimmt den allgemeinen Fehlertext, wenn kein Code passt. */
export type SubjectAction = 'create';

/** Texte fuer die Fehler der Fach-Aktionen (`{error, code}`). */
const FAILURE_TEXTS: FailureTexts<SubjectAction> = {
  codes: {
    forbidden: 'Dafür fehlt Ihnen das Recht „Fächer verwalten“.',
    subject_code_taken: 'Es gibt bereits ein Fach mit diesem Kürzel. Kürzel sind eindeutig, Groß- und Kleinschreibung zählt nicht.',
    invalid_request: `Bitte geben Sie ein Kürzel (1 bis ${MAX_CODE_LENGTH} Zeichen, nur Buchstaben, Ziffern, „-“ und „_“) und eine Bezeichnung mit 1 bis ${MAX_NAME_LENGTH} Zeichen an.`
  },
  fallback: {
    create: 'Das Fach konnte nicht angelegt werden. Bitte versuchen Sie es erneut.'
  }
};

/** Text zu einer abgelehnten Anfrage auf Faecher. */
export function describeSubjectFailure(err: unknown, action: SubjectAction = 'create'): string {
  return describeFailure(err, action, FAILURE_TEXTS);
}
