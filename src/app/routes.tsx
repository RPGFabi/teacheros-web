export type PortalId = 'teacher' | 'admin' | 'accounts' | 'account';

export interface Portal {
  id: PortalId;
  label: string;
  path: string;
  description: string;
  /** Recht aus GET /api/me, das fuer den Menuepunkt noetig ist; ohne Angabe sieht ihn jedes Konto. */
  requires?: string;
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
    id: 'account',
    label: 'Mein Konto',
    path: '#/konto',
    description: 'Ihre Kontodaten und Abmeldung.'
  }
];
