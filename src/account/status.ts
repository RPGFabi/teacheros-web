import { formatDate } from '../shared';

/** Anzeigetexte fuer den Kontostatus der API (`eingeladen`, `aktiv`, `deaktiviert`); unbekannte Werte erscheinen unveraendert. */
const STATUS_LABEL: Record<string, string> = { active: 'Aktiv', invited: 'Eingeladen', inactive: 'Deaktiviert' };

/** Statustext; ein deaktiviertes Konto nennt mit `inactiveSince` auch das Datum der Deaktivierung. */
export function statusLabel(status: string, inactiveSince?: string | null): string {
  const label = STATUS_LABEL[status] ?? status;
  return status === 'inactive' && inactiveSince ? `${label} seit ${formatDate(inactiveSince)}` : label;
}

/** Kennzeichnung eines deaktivierten Kontos, dessen Deaktivierung dem Anmeldedienst noch nicht gemeldet ist (Ticket #42). */
export const SYNC_PENDING_LABEL = 'Abgleich offen';
