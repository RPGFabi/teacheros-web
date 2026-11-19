import type { Me } from './AccountPage';

/** Die drei Verwaltungsrechte (ADR 0002 B4): mit einem davon sind Rollen und Zuweisungen lesbar. */
export const ADMINISTRATION_PERMISSIONS = ['roles.manage', 'roles.assign', 'permissions.assign'];

/** Hat das angemeldete Konto das Recht? Die API liefert die fertige Rechte-Liste; hier wird nur nachgeschlagen. */
export function hasPermission(me: Me | null, permission: string): boolean {
  return (me?.permissions ?? []).includes(permission);
}
