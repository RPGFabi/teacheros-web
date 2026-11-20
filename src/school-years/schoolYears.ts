import { describeFailure, type FailureTexts } from '../api/errors';

const REAL_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

function yearOfRealDay(value: string): number | null {
  const match = REAL_DAY.exec(value);
  if (!match) {
    return null;
  }
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? year : null;
}

/**
 * Vorschau der Bezeichnung zu den Eingaben: "JJJJ/JJ" (Jahr des Beginns / letzte zwei Ziffern des Endjahres), wie sie die
 * API erzeugt; die API bleibt massgeblich. Das Ende muss im Kalenderjahr nach dem Beginn liegen, sonst ein Hinweis.
 * Ohne zwei echte Kalendertage gibt es weder Bezeichnung noch Hinweis.
 */
export function previewName(startsOn: string, endsOn: string): { name?: string; problem?: string } {
  const startYear = yearOfRealDay(startsOn);
  const endYear = yearOfRealDay(endsOn);
  if (startYear === null || endYear === null) {
    return {};
  }
  if (endYear !== startYear + 1) {
    return { problem: 'Das Ende muss im Kalenderjahr nach dem Beginn liegen.' };
  }
  return { name: `${startYear}/${String(endYear % 100).padStart(2, '0')}` };
}

/** Was die Verwaltung mit einem Schuljahr tun wollte; bestimmt die allgemeine Fehlermeldung. */
export type SchoolYearAction = 'create' | 'update' | 'delete';

/**
 * Texte fuer die Fehler beim Anlegen, Bearbeiten und Loeschen (`{error, code}`). Ein Einwand eines anderen Moduls
 * (Erweiterungspunkt der API, Ticket #56) kommt als `409` mit eigenem Code und deutscher Meldung; die Meldung wird
 * angezeigt, wenn der Code hier nicht bekannt ist.
 */
const FAILURE_TEXTS: FailureTexts<SchoolYearAction> = {
  codes: {
    forbidden: 'Dafür fehlt Ihnen das Recht „Schuljahre verwalten“.',
    school_year_overlap: 'Der Zeitraum überschneidet sich mit einem bestehenden Schuljahr. Schuljahre dürfen sich nicht überschneiden; Lücken dazwischen sind erlaubt.',
    invalid_period: 'Das Ende muss im Kalenderjahr nach dem Beginn liegen.',
    invalid_request: 'Bitte geben Sie Beginn und Ende als gültige Kalendertage an.',
    school_years_busy: 'Die Schuljahre werden gerade geändert. Bitte versuchen Sie es gleich noch einmal.',
    school_year_not_found: 'Das Schuljahr gibt es nicht mehr. Die Liste wurde neu geladen.',
    school_year_has_classes: 'Das Schuljahr hat Klassen, auch archivierte, und bleibt deshalb bestehen. Es lässt sich nicht löschen.',
    school_year_in_use: 'Das Schuljahr wird noch verwendet und lässt sich nicht löschen.'
  },
  fallback: {
    create: 'Das Schuljahr konnte nicht angelegt werden. Bitte versuchen Sie es erneut.',
    update: 'Das Schuljahr konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.',
    delete: 'Das Schuljahr konnte nicht gelöscht werden. Bitte versuchen Sie es erneut.'
  },
  showApiMessageOnStatus: 409
};

/** Text zu einer abgelehnten Anfrage auf Schuljahren. */
export function describeSchoolYearFailure(err: unknown, action: SchoolYearAction = 'create'): string {
  return describeFailure(err, action, FAILURE_TEXTS);
}
