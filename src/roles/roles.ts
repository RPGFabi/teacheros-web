/** Rolle laut `GET /api/roles` (Ticket #32). Wildcard-Rollen kommen als `all_permissions`; `*` gibt es hier nie. */
export interface RoleRow {
  id: string;
  /** Technischer Schluessel; bei Standardrollen fest (`lehrkraft`), bei eigenen Rollen zufaellig. */
  key: string;
  name: string;
  description: string | null;
  /** Rechte-Schluessel; bei `all_permissions` der aufgeloeste Katalog. */
  permissions: string[];
  all_permissions: boolean;
  requires_mfa: boolean;
  protection: 'wildcard' | 'protected' | 'standard' | 'custom' | string;
  account_count: number;
}

/** Recht laut `GET /api/permissions`: deutscher Name und Gruppe. */
export interface CatalogEntry {
  key: string;
  name: string;
  group: string;
}

/** Anzeigetexte der Schutzstufen; unbekannte Werte erscheinen unveraendert. */
const PROTECTION_LABEL: Record<string, string> = {
  wildcard: 'Alle Rechte fest',
  protected: 'Rechte fest',
  standard: 'Standardrolle',
  custom: 'Eigene Rolle'
};

export function protectionLabel(protection: string): string {
  return PROTECTION_LABEL[protection] ?? protection;
}

/** Deutscher Name eines Rechts aus dem Katalog; ohne Eintrag der Schluessel. */
export function permissionName(catalog: CatalogEntry[], key: string): string {
  return catalog.find((entry) => entry.key === key)?.name ?? key;
}

/** Rechte nach Katalog-Gruppe, in Katalogreihenfolge (Gruppen in der Reihenfolge ihres ersten Rechts). */
export function groupCatalog(catalog: CatalogEntry[]): { group: string; entries: CatalogEntry[] }[] {
  const groups: { group: string; entries: CatalogEntry[] }[] = [];
  for (const entry of catalog) {
    const existing = groups.find((g) => g.group === entry.group);
    if (existing) {
      existing.entries.push(entry);
    } else {
      groups.push({ group: entry.group, entries: [entry] });
    }
  }
  return groups;
}

/** Verstaendliche Texte fuer die Fehlercodes der Rollen-Schreibwege (`{error, code}`, Ticket #33). */
const ERROR_TEXT: Record<string, string> = {
  forbidden: 'Dafür fehlt Ihnen das Recht „Rollen verwalten“.',
  permission_not_held: 'Sie können nur Rechte vergeben, die Sie selbst besitzen.',
  self_escalation: 'Eine Rolle, die Sie selbst innehaben, können Sie nicht erweitern.',
  role_protected: 'Diese Rolle ist geschützt: Standardrollen lassen sich nicht löschen, Schuladmin und Schüler/in nicht bearbeiten, und das MFA-Merkmal einer Standardrolle ist fest.',
  role_in_use: 'Die Rolle ist noch Konten zugewiesen und lässt sich nicht löschen.',
  role_not_found: 'Diese Rolle gibt es nicht mehr. Die Liste wurde neu geladen.',
  invalid_request: 'Die Angaben wurden abgelehnt. Bitte prüfen Sie Name, Beschreibung und Rechte.'
};

export function describeRoleFailure(err: unknown, fallback: string): string {
  const code = (err as { response?: { data?: { code?: unknown } } })?.response?.data?.code;
  return (typeof code === 'string' && ERROR_TEXT[code]) || fallback;
}
