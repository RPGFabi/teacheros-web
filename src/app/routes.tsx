import type { Me } from '../account/AccountPage';
import { ADMINISTRATION_PERMISSIONS, hasPermission } from '../account/permissions';
import { isModuleActive, type ModuleId } from './modules';

export type PortalId = 'teacher' | 'admin' | 'accounts' | 'roles' | 'school-years' | 'classes' | 'subjects' | 'school-settings' | 'teaching-groups' | 'account';

export interface Portal {
  id: PortalId;
  label: string;
  path: string;
  description: string;
  /** Recht aus GET /api/me, das fuer den Menuepunkt noetig ist; ohne Angabe sieht ihn jedes Konto. */
  requires?: string;
  /** Wie `requires`, aber ein beliebiges der Rechte genuegt (z. B. die drei Verwaltungsrechte der Rollen). */
  requiresAny?: string[];
  /** Modul, zu dem der Menuepunkt gehoert; ohne Angabe `core` (immer aktiv). Inaktive Module sind ausgeblendet. */
  module?: ModuleId;
}

/**
 * Menuepunkte, die das Konto sieht: Modul freigegeben und Recht vorhanden. Wie in der API zuerst das Modul, dann das
 * Recht; beides kommt fertig aus GET /api/me, hier wird nur nachgeschlagen.
 */
export function visiblePortals(me: Me | null, list: Portal[] = portals): Portal[] {
  return list.filter(
    (p) =>
      isModuleActive(me, p.module ?? 'core') &&
      (!p.requires || hasPermission(me, p.requires)) &&
      (!p.requiresAny || p.requiresAny.some((permission) => hasPermission(me, permission)))
  );
}

// Portale laut Source of Truth 17.11. Dazu kommt "Mein Konto" fuer jedes angemeldete Konto.
export const portals: Portal[] = [
  {
    id: 'teacher',
    label: 'Lehrkräfteportal',
    path: '#/lehrkraefte',
    description: 'Unterricht, Bewertung und Planung für Lehrkräfte.'
  },
  {
    id: 'admin',
    label: 'Verwaltungsportal',
    path: '#/verwaltung',
    description: 'Stammdaten, Schuljahre und Organisation für die Schulverwaltung.'
  },
  {
    id: 'accounts',
    label: 'Konten',
    path: '#/konten',
    description: 'Konten der Schulinstanz.',
    requires: 'accounts.view'
  },
  {
    id: 'roles',
    label: 'Rollen',
    path: '#/rollen',
    description: 'Rollen und Rechte der Schulinstanz.',
    requiresAny: ADMINISTRATION_PERMISSIONS
  },
  {
    id: 'school-years',
    label: 'Schuljahre',
    path: '#/schuljahre',
    description: 'Schuljahre der Schulinstanz.',
    requires: 'school_years.view'
  },
  {
    id: 'classes',
    label: 'Klassen',
    path: '#/klassen',
    description: 'Klassen je Schuljahr.',
    requires: 'classes.view'
  },
  {
    id: 'subjects',
    label: 'Fächer',
    path: '#/faecher',
    description: 'Fächer der Schulinstanz.',
    requires: 'subjects.view'
  },
  {
    id: 'school-settings',
    label: 'Schuleinstellungen',
    path: '#/schuleinstellungen',
    description: 'Obergrenzen der Schule für Lehrkräfte und Klassenleitungen.',
    requires: 'school_settings.manage'
  },
  {
    id: 'teaching-groups',
    label: 'Fachgruppen',
    path: '#/fachgruppen',
    description: 'Fachgruppen je Schuljahr.',
    requires: 'teaching_groups.view'
  },
  {
    id: 'account',
    label: 'Mein Konto',
    path: '#/konto',
    description: 'Ihre Kontodaten und Abmeldung.'
  }
];
