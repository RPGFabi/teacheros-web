import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import TeacherAssignmentsSection from './TeacherAssignmentsSection';
import { fakeClient, type FakeCall } from '../test/fakeHttp';

const MUELLER = { id: 't1', login_name: 'mueller', email: 'mueller@example.test', status: 'active' };
const SCHMIDT = { id: 't2', login_name: 'schmidt', email: null, status: 'invited' };
const assignment = (id: string, teacher = MUELLER, over: Record<string, unknown> = {}) => ({
  id,
  teaching_group_id: 'g1',
  teacher,
  starts_on: '2026-09-14',
  ends_on: null,
  last_day: '2027-07-29',
  status: 'running',
  ...over
});

const listRoute = (items: unknown[]) => ({ 'GET /api/teacher-assignments': { data: { teacher_assignments: items } } });
const teachersRoute = (items: unknown[] = [MUELLER, SCHMIDT]) => ({ 'GET /api/teacher-assignments/teachers': { data: { teachers: items } } });

describe('Lehrkraefte der Fachgruppe: Liste', () => {
  it('laedt die Zuordnungen der Fachgruppe und zeigt Lehrkraft, Zeitraum und Status', async () => {
    const { client, calls } = fakeClient(
      listRoute([
        assignment('a1', MUELLER, { ends_on: '2026-12-18', last_day: '2026-12-18', status: 'ended' }),
        assignment('a2', SCHMIDT, { starts_on: '2027-01-11', status: 'upcoming' }),
        assignment('a3', { ...MUELLER, id: 't3', login_name: 'gesperrt', status: 'inactive' }, { status: 'running' })
      ])
    );
    render(<TeacherAssignmentsSection apiClient={client} teachingGroupId="g1" canManage={false} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Lehrkräfte' })).toBeInTheDocument();
    expect(screen.getByText('Lehrkräfte werden geladen …')).toBeInTheDocument();
    const first = (await screen.findByRole('rowheader', { name: /^mueller/ })).closest('tr')!;
    expect(within(first).getByText('14.09.2026 bis 18.12.2026')).toHaveAttribute('data-label', 'Gültigkeitszeitraum');
    expect(within(first).getByText('beendet')).toBeInTheDocument();
    const second = screen.getByRole('rowheader', { name: /schmidt/ }).closest('tr')!;
    expect(within(second).getByText('ab 11.01.2027, offen (bis Schuljahresende 29.07.2027)')).toBeInTheDocument();
    expect(within(second).getByText('kommend')).toBeInTheDocument();
    expect(within(screen.getByRole('rowheader', { name: /gesperrt/ }).closest('tr')!).getByText('Konto deaktiviert')).toBeInTheDocument();
    expect(calls.find((c) => c.url === '/api/teacher-assignments')?.params).toEqual({ teaching_group_id: 'g1' });
  });

  it('sagt, wenn es noch keine Zuordnung gibt', async () => {
    const { client } = fakeClient(listRoute([]));
    render(<TeacherAssignmentsSection apiClient={client} teachingGroupId="g1" canManage={false} />);

    expect(await screen.findByText('Dieser Fachgruppe ist noch keine Lehrkraft zugeordnet.')).toBeInTheDocument();
  });

  it('zeigt einen Ladefehler mit „Erneut laden“', async () => {
    let fail = true;
    const { client } = fakeClient({ 'GET /api/teacher-assignments': () => (fail ? { status: 500 } : { data: { teacher_assignments: [assignment('a1')] } }) });
    render(<TeacherAssignmentsSection apiClient={client} teachingGroupId="g1" canManage={false} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Die Lehrkräfte der Fachgruppe konnten nicht geladen werden.');
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Erneut laden' }));

    expect(await screen.findByRole('rowheader', { name: /mueller/ })).toBeInTheDocument();
  });

  it('ohne Recht gibt es weder Formular noch Aktionen und die Lehrkraefte-Auswahl wird nicht geladen', async () => {
    const { client, calls } = fakeClient({ ...listRoute([assignment('a1', MUELLER, { status: 'upcoming' })]), ...teachersRoute() });
    render(<TeacherAssignmentsSection apiClient={client} teachingGroupId="g1" canManage={false} />);

    await screen.findByRole('rowheader', { name: /mueller/ });
    expect(screen.queryByRole('form', { name: 'Lehrkraft zuordnen' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Beenden|Löschen/ })).not.toBeInTheDocument();
    expect(calls.some((c) => c.url === '/api/teacher-assignments/teachers')).toBe(false);
  });
});

describe('Lehrkraefte der Fachgruppe: zuordnen', () => {
  it('ordnet mit Standard-Zeitraum zu: nur die Lehrkraft wird gesendet, danach laedt die Liste neu', async () => {
    const items: unknown[] = [];
    const { client, calls } = fakeClient({
      'GET /api/teacher-assignments': () => ({ data: { teacher_assignments: items } }),
      ...teachersRoute(),
      'POST /api/teacher-assignments': (call: FakeCall) => {
        items.push(assignment('a1', MUELLER));
        return { status: 201, data: { teacher_assignment: assignment('a1', MUELLER), echo: call.data } };
      }
    });
    render(<TeacherAssignmentsSection apiClient={client} teachingGroupId="g1" canManage />);

    const form = await screen.findByRole('form', { name: 'Lehrkraft zuordnen' });
    expect(within(screen.getByLabelText('Lehrkraft')).getAllByRole('option').map((o) => o.textContent)).toEqual(['Lehrkraft wählen', 'mueller (mueller@example.test)', 'schmidt']);
    expect(within(form).getByRole('button', { name: 'Zuordnen' })).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText('Lehrkraft'), 't1');
    await userEvent.click(within(form).getByRole('button', { name: 'Zuordnen' }));

    expect(await screen.findByRole('status')).toHaveTextContent('mueller wurde der Fachgruppe zugeordnet.');
    expect(calls.find((c) => c.method === 'POST')?.data).toEqual({ teaching_group_id: 'g1', teacher_id: 't1' });
    expect(await screen.findByRole('rowheader', { name: /mueller/ })).toBeInTheDocument();
  });

  it('sendet Beginn und Ende, wenn sie angegeben sind', async () => {
    const { client, calls } = fakeClient({
      ...listRoute([]),
      ...teachersRoute(),
      'POST /api/teacher-assignments': { status: 201, data: { teacher_assignment: assignment('a1', SCHMIDT) } }
    });
    render(<TeacherAssignmentsSection apiClient={client} teachingGroupId="g1" canManage />);
    await screen.findByRole('form', { name: 'Lehrkraft zuordnen' });

    await userEvent.selectOptions(screen.getByLabelText('Lehrkraft'), 't2');
    await userEvent.type(screen.getByLabelText('Beginn'), '2026-10-01');
    await userEvent.type(screen.getByLabelText('Ende (einschließlich)'), '2026-12-18');
    await userEvent.click(screen.getByRole('button', { name: 'Zuordnen' }));

    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.data).toEqual({ teaching_group_id: 'g1', teacher_id: 't2', starts_on: '2026-10-01', ends_on: '2026-12-18' }));
  });

  it('sperrt das Absenden bei einem Ende vor dem Beginn und nennt den Grund', async () => {
    const { client } = fakeClient({ ...listRoute([]), ...teachersRoute() });
    render(<TeacherAssignmentsSection apiClient={client} teachingGroupId="g1" canManage />);
    await screen.findByRole('form', { name: 'Lehrkraft zuordnen' });

    await userEvent.selectOptions(screen.getByLabelText('Lehrkraft'), 't1');
    await userEvent.type(screen.getByLabelText('Beginn'), '2026-10-02');
    await userEvent.type(screen.getByLabelText('Ende (einschließlich)'), '2026-10-01');

    expect(screen.getByRole('alert')).toHaveTextContent('Das Ende darf nicht vor dem Beginn liegen.');
    expect(screen.getByRole('button', { name: 'Zuordnen' })).toBeDisabled();
  });

  it('uebersetzt die Ablehnung der API (Ueberschneidung) in einen Hinweis', async () => {
    const { client } = fakeClient({
      ...listRoute([]),
      ...teachersRoute(),
      'POST /api/teacher-assignments': { status: 409, data: { code: 'assignment_overlap', error: 'x' } }
    });
    render(<TeacherAssignmentsSection apiClient={client} teachingGroupId="g1" canManage />);
    await screen.findByRole('form', { name: 'Lehrkraft zuordnen' });

    await userEvent.selectOptions(screen.getByLabelText('Lehrkraft'), 't1');
    await userEvent.click(screen.getByRole('button', { name: 'Zuordnen' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('überschneiden');
  });

  it('weist darauf hin, wenn es keine waehlbare Lehrkraft gibt', async () => {
    const { client } = fakeClient({ ...listRoute([]), ...teachersRoute([]) });
    render(<TeacherAssignmentsSection apiClient={client} teachingGroupId="g1" canManage />);

    expect(await screen.findByText(/Es gibt noch keine wählbare Lehrkraft/)).toBeInTheDocument();
  });
});

describe('Lehrkraefte der Fachgruppe: beenden und loeschen', () => {
  it('beendet mit einem Datum: ein Formular zur Zuordnung, gesendet wird das Ende, danach laedt die Liste neu', async () => {
    const { client, calls } = fakeClient({
      ...listRoute([assignment('a1')]),
      ...teachersRoute(),
      'POST /api/teacher-assignments/a1/end': { data: { teacher_assignment: assignment('a1', MUELLER, { ends_on: '2026-12-18' }) } }
    });
    render(<TeacherAssignmentsSection apiClient={client} teachingGroupId="g1" canManage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Beenden: mueller' }));
    const form = screen.getByRole('form', { name: 'Zuordnung beenden' });
    await userEvent.type(within(form).getByLabelText('Letzter Tag (leer: heute)'), '2026-12-18');
    await userEvent.click(within(form).getByRole('button', { name: 'Beenden' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Die Zuordnung von mueller wurde beendet.');
    expect(calls.find((c) => c.url === '/api/teacher-assignments/a1/end')?.data).toEqual({ ends_on: '2026-12-18' });
    expect(screen.queryByRole('form', { name: 'Zuordnung beenden' })).not.toBeInTheDocument();
  });

  it('beendet ohne Datum zum heutigen Tag (leerer Body)', async () => {
    const { client, calls } = fakeClient({
      ...listRoute([assignment('a1')]),
      ...teachersRoute(),
      'POST /api/teacher-assignments/a1/end': { data: { teacher_assignment: assignment('a1') } }
    });
    render(<TeacherAssignmentsSection apiClient={client} teachingGroupId="g1" canManage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Beenden: mueller' }));
    await userEvent.click(within(screen.getByRole('form', { name: 'Zuordnung beenden' })).getByRole('button', { name: 'Beenden' }));

    await waitFor(() => expect(calls.find((c) => c.url === '/api/teacher-assignments/a1/end')?.data).toEqual({}));
  });

  it('zeigt die Ablehnung beim Beenden und laesst das Formular offen', async () => {
    const { client } = fakeClient({
      ...listRoute([assignment('a1')]),
      ...teachersRoute(),
      'POST /api/teacher-assignments/a1/end': { status: 409, data: { code: 'assignment_applied', error: 'x' } }
    });
    render(<TeacherAssignmentsSection apiClient={client} teachingGroupId="g1" canManage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Beenden: mueller' }));
    await userEvent.click(within(screen.getByRole('form', { name: 'Zuordnung beenden' })).getByRole('button', { name: 'Beenden' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('frühestens heute');
    expect(screen.getByRole('form', { name: 'Zuordnung beenden' })).toBeInTheDocument();
  });

  it('bietet Beenden nur fuer nicht beendete und Loeschen nur fuer kommende Zuordnungen an', async () => {
    const { client } = fakeClient({
      ...listRoute([
        assignment('a1', MUELLER, { status: 'ended', ends_on: '2026-10-01', last_day: '2026-10-01' }),
        assignment('a2', SCHMIDT, { status: 'upcoming', starts_on: '2027-01-11' }),
        assignment('a3', { ...MUELLER, id: 't3', login_name: 'weber' }, { status: 'running' })
      ]),
      ...teachersRoute()
    });
    render(<TeacherAssignmentsSection apiClient={client} teachingGroupId="g1" canManage />);
    await screen.findByRole('rowheader', { name: /schmidt/ });

    expect(screen.queryByRole('button', { name: 'Beenden: mueller' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Löschen: mueller' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Beenden: schmidt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Löschen: schmidt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Beenden: weber' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Löschen: weber' })).not.toBeInTheDocument();
  });

  it('loescht erst nach Bestaetigung', async () => {
    const { client, calls } = fakeClient({
      ...listRoute([assignment('a2', SCHMIDT, { status: 'upcoming', starts_on: '2027-01-11' })]),
      ...teachersRoute(),
      'POST /api/teacher-assignments/a2/delete': { data: { deleted: true, id: 'a2' } }
    });
    render(<TeacherAssignmentsSection apiClient={client} teachingGroupId="g1" canManage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Löschen: schmidt' }));
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Zuordnung von schmidt löschen?');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Löschen' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Die Zuordnung von schmidt wurde gelöscht.');
    expect(calls.some((c) => c.method === 'POST' && c.url === '/api/teacher-assignments/a2/delete')).toBe(true);
  });

  it('bricht das Loeschen ab, ohne etwas zu senden', async () => {
    const { client, calls } = fakeClient({ ...listRoute([assignment('a2', SCHMIDT, { status: 'upcoming' })]), ...teachersRoute() });
    render(<TeacherAssignmentsSection apiClient={client} teachingGroupId="g1" canManage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Löschen: schmidt' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Abbrechen' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });
});
