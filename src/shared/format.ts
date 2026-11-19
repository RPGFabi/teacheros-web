/** Datum einer ISO-8601-Zeit im deutschen Format, `–` ohne Zeit. */
export function formatDate(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString('de-DE') : '–';
}
