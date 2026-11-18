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
