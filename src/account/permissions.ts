import type { Me } from './AccountPage';

/** Die drei Verwaltungsrechte (ADR 0002 B4): mit einem davon sind Rollen und Zuweisungen lesbar. */
export const ADMINISTRATION_PERMISSIONS = ['roles.manage', 'roles.assign', 'permissions.assign'];

/** Zusaetzlich zu `accounts.view` oeffnet eines dieser Rechte das Kontodetail: die drei Verwaltungsrechte, `accounts.deactivate`, `accounts.revoke_sessions` oder `accounts.reset_mfa`. */
export const ACCOUNT_DETAIL_PERMISSIONS = [...ADMINISTRATION_PERMISSIONS, 'accounts.deactivate', 'accounts.revoke_sessions', 'accounts.reset_mfa'];

/** Hat das angemeldete Konto das Recht? Die API liefert die fertige Rechte-Liste; hier wird nur nachgeschlagen. */
export function hasPermission(me: Me | null, permission: string): boolean {
  return (me?.permissions ?? []).includes(permission);
}
