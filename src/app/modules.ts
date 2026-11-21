import type { Me } from '../account/AccountPage';

/** Modul-IDs der API (Source of Truth 4.5). `core` ist immer aktiv. */
export type ModuleId = 'core' | 'observe' | 'grade' | 'class' | 'attendance' | 'connect' | 'forms' | 'finance' | 'planner' | 'substitute';

/**
 * Ist das Modul an der Schulinstanz freigegeben? Die API liefert die aktiven Module in GET /api/me; hier wird nur
 * nachgeschlagen. Solange `me` fehlt, gilt nur `core` als aktiv. Die API prueft die Freigabe ohnehin selbst
 * (403 `module_disabled`); das Ausblenden ist nur fuer die Navigation.
 */
export function isModuleActive(me: Me | null, module: ModuleId): boolean {
  return module === 'core' || (me?.modules ?? []).includes(module);
}
