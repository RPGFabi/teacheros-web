import { Button, Card, Chip } from '@hoelzle/react-ui';
import type { AxiosInstance } from 'axios';
import ClassesPanel from '../classes/ClassesPanel';
import { formatDay } from '../shared/format';
import { statusLabel, statusVariant, type SchoolYear } from '../shared/schoolYear';

interface Props {
  apiClient: AxiosInstance;
  year: SchoolYear;
  /** Recht `classes.view` aus GET /api/me; ohne es zeigt die Detailansicht keine Klassen. */
  canViewClasses: boolean;
  /** Recht `classes.manage` aus GET /api/me; ohne es gibt es kein Klasse-anlegen-Formular. */
  canManageClasses: boolean;
  onBack: () => void;
}

/** Detailansicht eines Schuljahres (Ticket #55): Zeitraum, Status und die Klassen des Schuljahres. */
export default function SchoolYearDetail({ apiClient, year, canViewClasses, canManageClasses, onBack }: Props) {
  return (
    <main className="content">
      <Button variant="secondary" onClick={onBack}>Zurück zu den Schuljahren</Button>
      <h1>Schuljahr {year.name}</h1>
      <Card>
        <dl>
          <dt>Beginn</dt>
          <dd>{formatDay(year.starts_on)}</dd>
          <dt>Ende</dt>
          <dd>{formatDay(year.ends_on)}</dd>
          <dt>Status</dt>
          <dd>
            <Chip variant={statusVariant(year.status)}>{statusLabel(year.status)}</Chip>
          </dd>
        </dl>
      </Card>
      <h2>Klassen</h2>
      {canViewClasses ? (
        <ClassesPanel key={year.id} apiClient={apiClient} schoolYear={year} canManage={canManageClasses} />
      ) : (
        <Card>
          <p>Zum Ansehen der Klassen fehlt Ihnen das Recht „Klassen ansehen“.</p>
        </Card>
      )}
    </main>
  );
}
