import type { Me } from './AccountPage';

/** Hat das angemeldete Konto das Recht? Die API liefert die fertige Rechte-Liste; hier wird nur nachgeschlagen. */
export function hasPermission(me: Me | null, permission: string): boolean {
  return (me?.permissions ?? []).includes(permission);
}
