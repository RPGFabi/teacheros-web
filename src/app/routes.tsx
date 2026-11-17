export type PortalId = 'teacher' | 'admin';

export interface Portal {
  id: PortalId;
  label: string;
  path: string;
  description: string;
}

// Portale laut Source of Truth 17.11. Der Login folgt in einem spaeteren Ticket.
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
  }
];
