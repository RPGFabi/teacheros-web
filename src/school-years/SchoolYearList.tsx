import { Button, Card, Chip } from '@hoelzle/react-ui';
import { formatDay } from '../shared/format';
import { statusLabel, statusVariant, type SchoolYear } from '../shared/schoolYear';

interface Props {
  /** `null`, solange die Liste noch laedt. */
  years: SchoolYear[] | null;
  loadError: boolean;
  /** Recht `school_years.manage`: nur dann gibt es die Spalte „Aktionen“. */
  canManage: boolean;
  busy: boolean;
  onReload: () => void;
  onOpen: (year: SchoolYear) => void;
  onEdit: (year: SchoolYear) => void;
  onDelete: (year: SchoolYear) => void;
}

/** Die Schuljahre nach Beginn mit Status; auf dem Smartphone wird die Tabelle per CSS zu Karten (`data-label` je Zelle). */
export default function SchoolYearList({ years, loadError, canManage, busy, onReload, onOpen, onEdit, onDelete }: Props) {
  return (
    <Card>
      {loadError && (
        <>
          <p role="alert">Die Schuljahre konnten nicht geladen werden.</p>
          <Button variant="secondary" onClick={onReload}>Erneut laden</Button>
        </>
      )}
      {!loadError && years === null && <p>Schuljahre werden geladen …</p>}
      {!loadError && years !== null && years.length === 0 && <p>Es gibt noch kein Schuljahr.</p>}
      {!loadError && years !== null && years.length > 0 && (
        <table className="responsive-table">
          <thead>
            <tr>
              <th scope="col">Schuljahr</th>
              <th scope="col">Beginn</th>
              <th scope="col">Ende</th>
              <th scope="col">Status</th>
              {canManage && <th scope="col">Aktionen</th>}
            </tr>
          </thead>
          <tbody>
            {years.map((year) => (
              <tr key={year.id}>
                <th scope="row">
                  <button type="button" className="link-button" onClick={() => onOpen(year)}>
                    {year.name}
                  </button>
                </th>
                <td data-label="Beginn">{formatDay(year.starts_on)}</td>
                <td data-label="Ende">{formatDay(year.ends_on)}</td>
                <td data-label="Status">
                  <Chip variant={statusVariant(year.status)}>{statusLabel(year.status)}</Chip>
                </td>
                {canManage && (
                  <td>
                    <Button variant="secondary" disabled={busy} aria-label={`Bearbeiten: ${year.name}`} onClick={() => onEdit(year)}>
                      Bearbeiten
                    </Button>{' '}
                    <Button variant="secondary" disabled={busy} aria-label={`Löschen: ${year.name}`} onClick={() => onDelete(year)}>
                      Löschen
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
