/** Anzeigetexte fuer den Kontostatus der API (`eingeladen`, `aktiv`, `deaktiviert`); unbekannte Werte erscheinen unveraendert. */
const STATUS_LABEL: Record<string, string> = { active: 'Aktiv', invited: 'Eingeladen', inactive: 'Deaktiviert' };

/** Datum einer ISO-8601-Zeit im deutschen Format, `–` ohne Zeit. */
export function formatDate(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString('de-DE') : '–';
}

/** Statustext; ein deaktiviertes Konto nennt mit `inactiveSince` auch das Datum der Deaktivierung. */
export function statusLabel(status: string, inactiveSince?: string | null): string {
  const label = STATUS_LABEL[status] ?? status;
  return status === 'inactive' && inactiveSince ? `${label} seit ${formatDate(inactiveSince)}` : label;
}
