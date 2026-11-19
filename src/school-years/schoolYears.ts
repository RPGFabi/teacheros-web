import { errorCode } from '../api/errors';

/** Status eines Schuljahres laut API: aus dem Datum abgeleitet, nie gespeichert (Glossar: Schuljahr). */
export type SchoolYearStatus = 'running' | 'upcoming' | 'past';

/** Schuljahr laut `GET /api/school-years` (Ticket #54); Beginn und Ende als Kalendertag `JJJJ-MM-TT`, beide inklusive. */
export interface SchoolYear {
  id: string;
  /** Bezeichnung, von der API aus dem Zeitraum erzeugt ("2026/27"); nicht eingebbar. */
  name: string;
  starts_on: string;
  ends_on: string;
  status: SchoolYearStatus | string;
}

const STATUS_LABEL: Record<string, string> = {
  running: 'laufend',
  upcoming: 'kommend',
  past: 'vergangen'
};

/** Anzeigename des Status (Begriffe des Glossars); unbekannte Werte erscheinen unveraendert. */
export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

/** Farbe des Status-Badges. */
export function statusVariant(status: string): 'success' | 'primary' | 'neutral' {
  return status === 'running' ? 'success' : status === 'upcoming' ? 'primary' : 'neutral';
}

/** Kalendertag `JJJJ-MM-TT` als `TT.MM.JJJJ`, ohne Zeitzone (anders als `formatDate`, das eine Zeit erwartet). */
export function formatDay(day: string): string {
  const [year, month, date] = day.split('-');
  return `${date}.${month}.${year}`;
}

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

/** Verstaendliche Texte fuer die Fehlercodes beim Anlegen (`{error, code}`). */
const ERROR_TEXT: Record<string, string> = {
  forbidden: 'Dafür fehlt Ihnen das Recht „Schuljahre verwalten“.',
  school_year_overlap: 'Der Zeitraum überschneidet sich mit einem bestehenden Schuljahr. Schuljahre dürfen sich nicht überschneiden; Lücken dazwischen sind erlaubt.',
  invalid_period: 'Das Ende muss im Kalenderjahr nach dem Beginn liegen.',
  invalid_request: 'Bitte geben Sie Beginn und Ende als gültige Kalendertage an.',
  school_years_busy: 'Die Schuljahre werden gerade geändert. Bitte versuchen Sie es gleich noch einmal.'
};

export function describeSchoolYearFailure(err: unknown): string {
  const code = errorCode(err);
  return (code !== undefined && ERROR_TEXT[code]) || 'Das Schuljahr konnte nicht angelegt werden. Bitte versuchen Sie es erneut.';
}
