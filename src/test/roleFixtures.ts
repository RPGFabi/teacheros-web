/** Rollen, wie `GET /api/roles` sie samt Aktionen liefert; die Regeln hier spiegeln die der API (RoleManagementRules). */
export interface Outcome {
  allowed: boolean;
  code: string | null;
  reason: string | null;
}

export const ALLOWED: Outcome = { allowed: true, code: null, reason: null };
export const refused = (code: string, reason: string): Outcome => ({ allowed: false, code, reason });

export const NOT_MANAGER = refused('forbidden', 'Dafür brauchen Sie das Recht „Rollen verwalten“.');
export const NOT_HELD = refused('permission_not_held', 'Sie können nur Rechte vergeben, die Sie selbst besitzen.');
export const SELF_ESCALATION = refused('self_escalation', 'Eine Rolle, die Sie selbst innehaben, können Sie nicht erweitern.');
const PROTECTED = refused('role_protected', 'Diese Rolle ist geschützt und lässt sich nicht bearbeiten.');

export interface Viewer {
  /** Betrachter ohne `roles.manage`: alles gesperrt. */
  forbidden?: boolean;
  /** Rechte, die der Betrachter nicht vergeben darf (P2). */
  notHeld?: string[];
}

interface Options extends Viewer {
  catalogKeys: string[];
}

/** Zeile von `GET /api/roles` mit den Aktionen, die die API fuer diese Rolle melden wuerde. */
export function role(over: Record<string, unknown>, options: Options = { catalogKeys: [] }) {
  const base = {
    id: 'r-' + over.key,
    description: null,
    permissions: [] as string[],
    all_permissions: false,
    requires_mfa: false,
    protection: 'standard',
    account_count: 0,
    ...over
  };
  const protection = base.protection as string;
  const locked = protection === 'wildcard' || protection === 'protected';
  const manage = (outcome: Outcome) => (options.forbidden ? NOT_MANAGER : outcome);
  const deleteOutcome =
    protection !== 'custom'
      ? refused('role_protected', 'Standardrollen lassen sich nicht löschen.')
      : base.account_count > 0
        ? refused('role_in_use', 'Die Rolle ist noch Konten zugewiesen.')
        : ALLOWED;
  const mfaOutcome = locked ? PROTECTED : protection !== 'custom' ? refused('role_protected', 'Das MFA-Merkmal einer Standardrolle ist fest.') : ALLOWED;
  const actions = [
    { action: 'edit', ...manage(locked ? PROTECTED : ALLOWED) },
    { action: 'delete', ...manage(deleteOutcome) },
    { action: 'set_mfa', ...manage(mfaOutcome) }
  ];
  const permission_actions = options.catalogKeys
    .filter((key) => !base.permissions.includes(key))
    .map((key) => ({ permission: key, ...manage(locked ? PROTECTED : options.notHeld?.includes(key) ? NOT_HELD : ALLOWED) }));
  return { ...base, actions, permission_actions };
}

/** Der Block `create` von `GET /api/roles`. */
export function createBlock(options: Options) {
  const outcome = options.forbidden ? NOT_MANAGER : ALLOWED;
  return {
    ...outcome,
    permission_actions: options.catalogKeys.map((key) => ({
      permission: key,
      ...(options.forbidden ? NOT_MANAGER : options.notHeld?.includes(key) ? NOT_HELD : ALLOWED)
    }))
  };
}
