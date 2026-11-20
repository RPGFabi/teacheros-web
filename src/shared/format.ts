/** Datum einer ISO-8601-Zeit im deutschen Format, `–` ohne Zeit. */
export function formatDate(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString('de-DE') : '–';
}

/** Kalendertag `JJJJ-MM-TT` als `TT.MM.JJJJ`, ohne Zeitzone (anders als `formatDate`, das eine Zeit erwartet). */
export function formatDay(day: string): string {
  const [year, month, date] = day.split('-');
  return `${date}.${month}.${year}`;
}
