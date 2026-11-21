/**
 * Was Schuljahre und Klassen gemeinsam brauchen (Glossar: Schuljahr): der Typ des Schuljahres, die Anzeige seines Status und
 * die Vorauswahl. Liegt hier und nicht in `school-years/`, damit `school-years` und `classes` einander nicht importieren;
 * beide hängen nur von `shared` ab.
 */

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

type StatusVariant = 'success' | 'primary' | 'neutral';

/** Anzeige je Status in einer Tabelle: Begriff des Glossars und Farbe des Badges. */
const STATUS_DISPLAY: Record<SchoolYearStatus, { label: string; variant: StatusVariant }> = {
  running: { label: 'laufend', variant: 'success' },
  upcoming: { label: 'kommend', variant: 'primary' },
  past: { label: 'vergangen', variant: 'neutral' }
};

function displayOf(status: string): { label: string; variant: StatusVariant } | undefined {
  return Object.prototype.hasOwnProperty.call(STATUS_DISPLAY, status) ? STATUS_DISPLAY[status as SchoolYearStatus] : undefined;
}

/** Anzeigename des Status (Begriffe des Glossars); unbekannte Werte erscheinen unveraendert. */
export function statusLabel(status: string): string {
  return displayOf(status)?.label ?? status;
}

/** Farbe des Status-Badges; unbekannte Werte neutral. */
export function statusVariant(status: string): StatusVariant {
  return displayOf(status)?.variant ?? 'neutral';
}

/**
 * Vorausgewaehltes Schuljahr einer Auswahl (Seite „Klassen“): das laufende, sonst das zuletzt vergangene, sonst das naechste
 * kommende. Das ist dieselbe Regel wie der Status der API (laufend ist auch das naechste kommende, wenn heute in einer
 * Luecke zwischen zwei Schuljahren liegt; vor dem ersten Schuljahr laeuft keines); hier wird nur der fertige Status
 * gelesen, nichts aus Daten berechnet. `years` kommt nach Beginn aufsteigend. Ohne Schuljahr gibt es keine Vorauswahl.
 */
export function defaultSchoolYear<T extends Pick<SchoolYear, 'status'>>(years: T[]): T | undefined {
  return (
    years.find((y) => y.status === 'running') ??
    [...years].reverse().find((y) => y.status === 'past') ??
    years.find((y) => y.status === 'upcoming')
  );
}
