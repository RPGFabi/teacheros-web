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
 * Eine Aktion am Konto selbst (Ticket #41: `deactivate`; Ticket #42: `resync_login` = „Abgleich wiederholen“, nur solange
 * der Abgleich offen ist; Ticket #43: `reactivate`, nur bei deaktivierten Konten; Ticket #48: `revoke_sessions` = Sitzungen beenden; Ticket #49: `reset_totp` = TOTP zuruecksetzen); gesperrt mit Code und deutscher Begruendung.
 */
export interface AccountAction {
  action: 'deactivate' | 'resync_login' | 'reactivate' | 'revoke_sessions' | 'reset_totp';
  allowed: boolean;
  code: string | null;
  reason: string | null;
}

/**
 * Ein offener Aufruf an den Anmeldedienst („Abgleich offen“, Ticket #47): eine lokal schon wirksame Aenderung, die der
 * Dienst noch nicht bestaetigt hat. `operation` ist `disable_login` (Sperre) oder `revoke_sessions` (Sitzungswiderruf, Ticket #48) oder `reset_totp` (TOTP-Zuruecksetzung, Ticket #49). `rejection_code` ist der Code der letzten fachlichen Ablehnung, null bei
 * Nichterreichbarkeit.
 */
export interface OpenCall {
  operation: string;
  rejection_code: string | null;
}

/**
 * Lesesicht eines Kontos. Die Detailansicht gibt es nur mit `accounts.view` (die API verlangt es zusaetzlich zu einem
 * Verwaltungsrecht, `accounts.deactivate`, `accounts.revoke_sessions` oder `accounts.reset_mfa`); nur dann liefert sie auch E-Mail, Anmeldename und Status. Rollen und Rechte
 * (`roles`, `permissions`, `role_actions`, `permission_actions`) liefert die API nur, wenn der Betrachter eines der drei
 * Verwaltungsrechte hat; sonst fehlen sie, und die Ansicht zeigt nur das Konto.
 */
export interface AccountAccess {
  account: {
    id: string;
    email: string | null;
    login_name: string;
    status: string;
    /** ISO 8601 (UTC) der Deaktivierung, sonst null (Ticket #41). */
    inactive_since: string | null;
    /** Grund der Deaktivierung, z. B. `admin_locked`, sonst null. */
    inactive_reason: string | null;
    /** „Abgleich offen“ (Tickets #42, #47): die offenen Aufrufe in der Reihenfolge des Nachholens; leer, wenn nichts offen ist. Fehlt ohne `accounts.view`. */
    open_calls?: OpenCall[];
    mfa_required: boolean;
  };
  roles?: { id: string; key: string; name: string; protection: string; requires_mfa: boolean }[];
  permissions?: PermissionRow[];
  role_actions?: RoleAction[];
  permission_actions?: PermissionAction[];
  account_actions: AccountAction[];
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
