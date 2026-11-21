import { useCallback, useId, useState, type FormEvent } from 'react';
import { Button, Card, Chip, ConfirmDialog, FormField, Select, TextInput } from '@hoelzle/react-ui';
import type { AxiosInstance } from 'axios';
import { useResource } from '../shared/useResource';
import {
  assignmentFormProblem,
  canDelete,
  canEnd,
  describeTeacherAssignmentFailure,
  periodText,
  statusLabel,
  teacherLabel,
  type Teacher,
  type TeacherAssignment,
  type TeacherAssignmentAction
} from './teacherAssignments';

interface Props {
  apiClient: AxiosInstance;
  teachingGroupId: string;
  /** Recht `teacher_assignments.manage` aus GET /api/me; ohne es gibt es weder Formular noch Aktionen (die API verweigert sie ohnehin). */
  canManage: boolean;
}

const STATUS_VARIANT: Record<string, 'success' | 'primary' | 'neutral'> = { running: 'success', upcoming: 'primary', ended: 'neutral' };

/**
 * Abschnitt „Lehrkräfte“ in der Detailansicht einer Fachgruppe (Ticket #67; Glossar: Lehrkraft-Zuordnung,
 * Gueltigkeitszeitraum): die Zuordnungen mit Zeitraum und Status (kommend, laufend, beendet; ein deaktiviertes Konto bleibt
 * als Historie sichtbar) und, mit `teacher_assignments.manage`, Zuordnen (Lehrkraft, Beginn und Ende optional), Beenden
 * (letzter Tag, leer = heute) und Loeschen (mit Bestaetigung, nur fuer kommende). Welche Zeitraeume, Ueberschneidungen und
 * Obergrenzen zulaessig sind, entscheidet allein die API; hier wird ihre Ablehnung in einen Hinweis uebersetzt.
 */
export default function TeacherAssignmentsSection({ apiClient, teachingGroupId, canManage }: Props) {
  const formId = useId();
  const [teacherId, setTeacherId] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [ending, setEnding] = useState<TeacherAssignment | null>(null);
  const [lastDay, setLastDay] = useState('');
  const [deleting, setDeleting] = useState<TeacherAssignment | null>(null);

  const fetchAssignments = useCallback(
    async () => (await apiClient.get<{ teacher_assignments: TeacherAssignment[] }>('/api/teacher-assignments', { params: { teaching_group_id: teachingGroupId } })).data.teacher_assignments,
    [apiClient, teachingGroupId]
  );
  const { data: assignments, loadError, reload: load, busy, notice, error, run } = useResource<TeacherAssignment[], TeacherAssignmentAction>(fetchAssignments, describeTeacherAssignmentFailure);

  // Die Auswahl der Lehrkraefte braucht das Verwaltungsrecht: ohne es wird sie nicht geladen.
  const fetchTeachers = useCallback(async () => (canManage ? (await apiClient.get<{ teachers: Teacher[] }>('/api/teacher-assignments/teachers')).data.teachers : []), [apiClient, canManage]);
  const { data: teachers, loadError: teachersError, reload: reloadTeachers } = useResource<Teacher[]>(fetchTeachers);

  const problem = assignmentFormProblem(teacherId, startsOn, endsOn);
  // Ein Hinweis erscheint erst, wenn schon etwas eingegeben ist; ein leeres Formular ist nur gesperrt.
  const hint = teacherId !== '' || startsOn !== '' || endsOn !== '' ? problem : undefined;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (problem !== undefined) {
      return;
    }
    const chosen = teachers?.find((t) => t.id === teacherId);
    const ok = await run('create', async () => {
      await apiClient.post('/api/teacher-assignments', {
        teaching_group_id: teachingGroupId,
        teacher_id: teacherId,
        ...(startsOn !== '' && { starts_on: startsOn }),
        ...(endsOn !== '' && { ends_on: endsOn })
      });
      return `${chosen?.login_name ?? 'Die Lehrkraft'} wurde der Fachgruppe zugeordnet.`;
    });
    if (ok) {
      setTeacherId('');
      setStartsOn('');
      setEndsOn('');
    }
  };

  const end = async (target: TeacherAssignment) => {
    const ok = await run('end', async () => {
      await apiClient.post(`/api/teacher-assignments/${target.id}/end`, lastDay === '' ? {} : { ends_on: lastDay });
      return `Die Zuordnung von ${target.teacher.login_name} wurde beendet.`;
    });
    if (ok) {
      setEnding(null);
      setLastDay('');
    }
  };

  const remove = async (target: TeacherAssignment) => {
    setDeleting(null);
    await run('delete', async () => {
      await apiClient.post(`/api/teacher-assignments/${target.id}/delete`);
      return `Die Zuordnung von ${target.teacher.login_name} wurde gelöscht.`;
    });
  };

  return (
    <>
      <h2>Lehrkräfte</h2>
      {canManage && (
        <Card>
          <form aria-label="Lehrkraft zuordnen" onSubmit={(event) => void submit(event)}>
            <h3>Lehrkraft zuordnen</h3>
            {teachersError && (
              <>
                <p role="alert">Die Auswahl der Lehrkräfte konnte nicht geladen werden.</p>
                <Button variant="secondary" onClick={() => void reloadTeachers()}>Erneut laden</Button>
              </>
            )}
            {!teachersError && teachers === null && <p>Auswahl wird geladen …</p>}
            {!teachersError && teachers !== null && teachers.length === 0 && (
              <p>Es gibt noch keine wählbare Lehrkraft. Wählbar sind Konten mit der Rolle Lehrkraft, die nicht deaktiviert sind.</p>
            )}
            {!teachersError && teachers !== null && teachers.length > 0 && (
              <FormField label="Lehrkraft" htmlFor={`${formId}-teacher`}>
                <Select
                  id={`${formId}-teacher`}
                  value={teacherId}
                  placeholder="Lehrkraft wählen"
                  options={teachers.map((t) => ({ value: t.id, label: teacherLabel(t) }))}
                  onChange={(e) => setTeacherId(e.target.value)}
                />
              </FormField>
            )}
            <FormField label="Beginn" htmlFor={`${formId}-start`}>
              <TextInput id={`${formId}-start`} type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
            </FormField>
            <FormField label="Ende (einschließlich)" htmlFor={`${formId}-end`}>
              <TextInput id={`${formId}-end`} type="date" hasError={hint !== undefined && endsOn !== ''} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
            </FormField>
            <p>
              Ohne Beginn gilt die Zuordnung ab dem ersten Tag des Schuljahres, ohne Ende offen, also bis zum Ende des Schuljahres. Beide Tage liegen im Schuljahr der Fachgruppe.
              Mehrere Lehrkräfte können zugleich zugeordnet sein, bis zur Obergrenze der Schule; dieselbe Lehrkraft nicht mit sich überschneidendem Zeitraum.
            </p>
            <p aria-live="polite">{hint !== undefined && <span role="alert">{hint}</span>}</p>
            <Button type="submit" disabled={busy || teachers === null || problem !== undefined}>Zuordnen</Button>
          </form>
        </Card>
      )}
      {canManage && ending && (
        <Card>
          <form
            aria-label="Zuordnung beenden"
            onSubmit={(event) => {
              event.preventDefault();
              void end(ending);
            }}
          >
            <h3>Zuordnung von {ending.teacher.login_name} beenden</h3>
            <FormField label="Letzter Tag (leer: heute)" htmlFor={`${formId}-last-day`}>
              <TextInput id={`${formId}-last-day`} type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)} />
            </FormField>
            <p>Beenden setzt das Ende einer offenen Zuordnung oder verschiebt ein späteres Ende nach vorn. Was schon gegolten hat, bleibt unverändert: der letzte Tag liegt frühestens heute.</p>
            <Button type="submit" disabled={busy}>Beenden</Button>{' '}
            <Button
              variant="secondary"
              onClick={() => {
                setEnding(null);
                setLastDay('');
              }}
            >
              Abbrechen
            </Button>
          </form>
        </Card>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      <ConfirmDialog
        open={deleting !== null}
        title={`Zuordnung von ${deleting?.teacher.login_name ?? ''} löschen?`}
        description={`Die Zuordnung (${deleting ? periodText(deleting) : ''}) wird endgültig gelöscht. Das lässt sich nicht rückgängig machen. Nur eine Zuordnung, die noch nie gegolten hat, lässt sich löschen; sonst bleibt das Beenden.`}
        confirmText="Löschen"
        variant="danger"
        onConfirm={() => deleting && void remove(deleting)}
        onCancel={() => setDeleting(null)}
      />
      <Card>
        {loadError && (
          <>
            <p role="alert">Die Lehrkräfte der Fachgruppe konnten nicht geladen werden.</p>
            <Button variant="secondary" onClick={() => void load()}>Erneut laden</Button>
          </>
        )}
        {!loadError && assignments === null && <p>Lehrkräfte werden geladen …</p>}
        {!loadError && assignments !== null && assignments.length === 0 && <p>Dieser Fachgruppe ist noch keine Lehrkraft zugeordnet.</p>}
        {!loadError && assignments !== null && assignments.length > 0 && (
          <table className="responsive-table">
            <thead>
              <tr>
                <th scope="col">Lehrkraft</th>
                <th scope="col">Gültigkeitszeitraum</th>
                <th scope="col">Status</th>
                {canManage && <th scope="col">Aktionen</th>}
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id}>
                  <th scope="row">
                    {teacherLabel(a.teacher)}
                    {a.teacher.status === 'inactive' && (
                      <>
                        {' '}
                        <Chip variant="neutral">Konto deaktiviert</Chip>
                      </>
                    )}
                  </th>
                  <td data-label="Gültigkeitszeitraum">{periodText(a)}</td>
                  <td data-label="Status">
                    <Chip variant={STATUS_VARIANT[a.status] ?? 'neutral'}>{statusLabel(a.status)}</Chip>
                  </td>
                  {canManage && (
                    <td data-label="Aktionen">
                      {canEnd(a) && (
                        <Button
                          variant="secondary"
                          aria-label={`Beenden: ${a.teacher.login_name}`}
                          disabled={busy}
                          onClick={() => {
                            setEnding(a);
                            setLastDay('');
                          }}
                        >
                          Beenden
                        </Button>
                      )}{' '}
                      {canDelete(a) && (
                        <Button variant="secondary" aria-label={`Löschen: ${a.teacher.login_name}`} disabled={busy} onClick={() => setDeleting(a)}>
                          Löschen
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
