import { describe, expect, it } from 'vitest';
import type { Me } from '../account/AccountPage';
import { isModuleActive } from './modules';
import { portals, visiblePortals, type Portal } from './routes';

const me = (modules: string[] | undefined, permissions: string[] = []): Me => ({
  account: { id: '13131313-1313-4131-8131-131313131313', status: 'active', mfa_required: false },
  permissions,
  modules,
  session: { used_mfa: false, expires_at: '2026-11-19T12:00:00+00:00' }
});

// Stellvertretend fuer den ersten Menuepunkt eines Fachmoduls (es gibt noch keinen echten).
const observe: Portal = { id: 'teacher', label: 'Beobachtungen', path: '#/beobachtungen', description: '', module: 'observe' };
const observeWithRight: Portal = { ...observe, label: 'Auswertung', requires: 'accounts.view' };

describe('Modulfreigabe in der Navigation (Ticket #13)', () => {
  it('blendet den Menuepunkt eines inaktiven Moduls aus', () => {
    expect(visiblePortals(me(['core']), [observe])).toEqual([]);
  });

  it('zeigt den Menuepunkt eines aktiven Moduls', () => {
    expect(visiblePortals(me(['core', 'observe']), [observe])).toEqual([observe]);
  });

  it('aktives Modul ersetzt kein Recht', () => {
    expect(visiblePortals(me(['core', 'observe']), [observeWithRight])).toEqual([]);
    expect(visiblePortals(me(['core', 'observe'], ['accounts.view']), [observeWithRight])).toEqual([observeWithRight]);
  });

  it('ein Recht ersetzt keine Freigabe', () => {
    expect(visiblePortals(me(['core'], ['accounts.view']), [observeWithRight])).toEqual([]);
  });

  it('core ist immer aktiv, auch ohne geladene Daten oder ohne modules-Feld', () => {
    expect(isModuleActive(null, 'core')).toBe(true);
    expect(isModuleActive(me(undefined), 'core')).toBe(true);
    expect(isModuleActive(me(undefined), 'observe')).toBe(false);
    expect(isModuleActive(null, 'observe')).toBe(false);
  });

  it('die heutigen Portale gehoeren zu core und bleiben ohne Freigaben sichtbar', () => {
    expect(visiblePortals(me(['core'])).map((p) => p.id)).toEqual(['teacher', 'admin', 'account']);
    expect(portals.every((p) => (p.module ?? 'core') === 'core')).toBe(true);
  });
});
