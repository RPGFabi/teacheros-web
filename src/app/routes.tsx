export type PortalId = 'teacher' | 'admin' | 'account';

export interface Portal {
  id: PortalId;
  label: string;
  path: string;
  description: string;
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
    id: 'account',
    label: 'Mein Konto',
    path: '#/konto',
    description: 'Ihre Kontodaten und Abmeldung.'
  }
];
