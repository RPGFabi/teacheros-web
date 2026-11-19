/** Herkunft eines Rechts laut `GET /api/accounts/{id}/access` (Ticket #34). */
export type PermissionSource =
  | { kind: 'role'; role_id: string; role_key: string; role_name: string }
  /** Einzelrecht gewaehrt (Ticket #36). */
  | { kind: 'individual' }
  /** Einzelrecht entzogen: das Recht gilt dann nicht, auch wenn eine Rolle es gibt. */
  | { kind: 'withdrawn' };

export interface PermissionRow {
  key: string;
  name: string;
  group: string;
  /** false bei entzogenem Einzelrecht. */
  effective: boolean;
  sources: PermissionSource[];
}

/** Die fuer den Betrachter moegliche Aktion zu einer Rolle; gesperrt mit Code und deutscher Begruendung. */
export interface RoleAction {
  role_id: string;
  role_key: string;
  role_name: string;
  action: 'assign' | 'revoke';
  allowed: boolean;
  code: string | null;
  reason: string | null;
}

/**
 * Die fuer den Betrachter moegliche Einzelrecht-Aktion zu einem Katalogrecht (Ticket #36): `grant` (gewaehren),
 * `withdraw` (trotz Rolle entziehen) oder `clear` (zuruecksetzen: es gilt wieder, was die Rollen ergeben).
 * Gesperrt mit Code und deutscher Begruendung.
 */
export interface PermissionAction {
  permission: string;
  name: string;
  group: string;
  action: 'grant' | 'withdraw' | 'clear';
  allowed: boolean;
  code: string | null;
  reason: string | null;
}

/**
 * Lesesicht eines Kontos. Die Detailansicht gibt es nur mit `accounts.view` (die API verlangt es zusaetzlich zu einem
 * Verwaltungsrecht); nur dann liefert sie auch E-Mail, Anmeldename und Status.
 */
export interface AccountAccess {
  account: { id: string; email: string | null; login_name: string; status: string; mfa_required: boolean };
  roles: { id: string; key: string; name: string; protection: string; requires_mfa: boolean }[];
  permissions: PermissionRow[];
  role_actions: RoleAction[];
  permission_actions: PermissionAction[];
}

/** Anzeigetext einer Herkunft. */
export function sourceLabel(source: PermissionSource): string {
  switch (source.kind) {
    case 'role':
      return `Rolle ${source.role_name}`;
    case 'individual':
      return 'Einzelrecht';
    case 'withdrawn':
      return 'Entzogen';
  }
}
