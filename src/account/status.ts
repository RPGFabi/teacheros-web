/** Anzeigetexte fuer den Kontostatus der API (`eingeladen`, `aktiv`, `inaktiv`); unbekannte Werte erscheinen unveraendert. */
const STATUS_LABEL: Record<string, string> = { active: 'Aktiv', invited: 'Eingeladen', inactive: 'Inaktiv' };

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}
