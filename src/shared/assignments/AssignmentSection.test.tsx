import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import AssignmentSection from './AssignmentSection';
import { TEACHERS_ENDPOINT, type AssignmentConfig } from './assignments';
import { CLASS_LEADERS } from '../../classes/classLeaders';
import { TEACHER_ASSIGNMENTS } from '../../teaching-groups/teacherAssignments';
import { fakeClient, type FakeCall } from '../../test/fakeHttp';

// Wer eine Zuordnung nur liest, bekommt von der Lehrkraft nur Kennung und Anmeldenamen; E-Mail und Kontostatus gibt es nur in der Auswahl.
const MUELLER = { id: 't1', login_name: 'mueller' };
const SCHMIDT = { id: 't2', login_name: 'schmidt' };
const SELECTABLE = [
  { id: 't1', login_name: 'mueller', email: 'mueller@example.test', status: 'active' },
  { id: 't2', login_name: 'schmidt', email: null, status: 'invited' }
];

/** Die Woerter, die sich je Art unterscheiden: der Abschnitt beider Stellen wird mit denselben Faellen geprueft. */
interface Kind {
  name: string;
  config: AssignmentConfig;
  parentId: string;
  heading: string;
  loading: string;
  empty: string;
  loadError: string;
  createForm: string;
  created: string;
  endForm: string;
  ended: string;
  deleteTitle: string;
  deleted: string;
  archived: RegExp;
  limit: string;
}

const KINDS: Kind[] = [
  {
    name: 'Lehrkraefte der Fachgruppe',
    config: TEACHER_ASSIGNMENTS,
    parentId: 'g1',
    heading: 'Lehrkräfte',
    loading: 'Lehrkräfte werden geladen …',
    empty: 'Dieser Fachgruppe ist noch keine Lehrkraft zugeordnet.',
    loadError: 'Die Lehrkräfte der Fachgruppe konnten nicht geladen werden.',
    createForm: 'Lehrkraft zuordnen',
    created: 'mueller wurde der Fachgruppe zugeordnet.',
    endForm: 'Zuordnung beenden',
    ended: 'Die Zuordnung von mueller wurde beendet.',
    deleteTitle: 'Zuordnung von schmidt löschen?',
    deleted: 'Die Zuordnung von schmidt wurde gelöscht.',
    archived: /Die Fachgruppe ist archiviert/,
    limit: 'Lehrkräfte je Fachgruppe'
  },
  {
    name: 'Klassenleitung',
    config: CLASS_LEADERS,
    parentId: 'c1',
    heading: 'Klassenleitung',
    loading: 'Klassenleitungen werden geladen …',
    empty: 'Dieser Klasse ist noch keine Klassenleitung zugeordnet.',
    loadError: 'Die Klassenleitungen der Klasse konnten nicht geladen werden.',
    createForm: 'Klassenleitung zuordnen',
    created: 'mueller wurde als Klassenleitung eingesetzt.',
    endForm: 'Klassenleitung beenden',
    ended: 'Die Klassenleitung von mueller wurde beendet.',
    deleteTitle: 'Klassenleitung von schmidt löschen?',
    deleted: 'Die Klassenleitung von schmidt wurde gelöscht.',
    archived: /Die Klasse ist archiviert/,
    limit: 'Klassenleitungen je Klasse'
  }
];

describe.each(KINDS)('Abschnitt Zuordnungen: $name', (kind) => {
  const { config, parentId } = kind;
  const { endpoint, parentKey, listKey } = config;
  const assignment = (id: string, teacher = MUELLER, over: Record<string, unknown> = {}) => ({
    id,
    [parentKey]: parentId,
    teacher,
    starts_on: '2026-09-14',
    ends_on: null,
    last_day: '2027-07-29',
    status: 'running',
    ...over
  });
  const listRoute = (items: unknown[]) => ({ [`GET ${endpoint}`]: { data: { [listKey]: items } } });
  const teachersRoute = (items: unknown[] = SELECTABLE) => ({ [`GET ${TEACHERS_ENDPOINT}`]: { data: { teachers: items } } });
  const mount = (client: ReturnType<typeof fakeClient>['client'], props: { canManage?: boolean; archived?: boolean } = {}) =>
    render(<AssignmentSection apiClient={client} config={config} parentId={parentId} canManage={props.canManage ?? false} archived={props.archived} />);

  describe('Liste', () => {
    it('laedt die Zuordnungen des Elternobjekts und zeigt Lehrkraft, Gueltigkeitszeitraum und Status', async () => {
      const { client, calls } = fakeClient(
        listRoute([
          assignment('a1', MUELLER, { ends_on: '2026-12-18', last_day: '2026-12-18', status: 'ended' }),
          assignment('a2', SCHMIDT, { starts_on: '2027-01-11', status: 'upcoming' })
        ])
      );
      mount(client);

      expect(screen.getByRole('heading', { level: 2, name: kind.heading })).toBeInTheDocument();
      expect(screen.getByText(kind.loading)).toBeInTheDocument();
      const first = (await screen.findByRole('rowheader', { name: 'mueller' })).closest('tr')!;
      expect(within(first).getByText('14.09.2026 bis 18.12.2026')).toHaveAttribute('data-label', 'Gültigkeitszeitraum');
      expect(within(first).getByText('beendet')).toBeInTheDocument();
      const second = screen.getByRole('rowheader', { name: 'schmidt' }).closest('tr')!;
      expect(within(second).getByText('ab 11.01.2027, offen (bis Schuljahresende 29.07.2027)')).toBeInTheDocument();
      expect(within(second).getByText('kommend')).toBeInTheDocument();
      expect(calls.find((c) => c.url === endpoint)?.params).toEqual({ [parentKey]: parentId });
    });

    it('zeigt nur den Anmeldenamen der Lehrkraft, auch bei einem Konto, das es nicht mehr gibt', async () => {
      const { client } = fakeClient(listRoute([assignment('a1', { id: 't9', login_name: '' }), assignment('a2', MUELLER)]));
      mount(client);

      const row = (await screen.findByRole('rowheader', { name: 'mueller' })).closest('tr')!;
      expect(row).not.toHaveTextContent('@');
      expect(row).not.toHaveTextContent('deaktiviert');
    });

    it('sagt, wenn es noch keine Zuordnung gibt', async () => {
      const { client } = fakeClient(listRoute([]));
      mount(client);

      expect(await screen.findByText(kind.empty)).toBeInTheDocument();
    });

    it('zeigt einen Ladefehler mit „Erneut laden“', async () => {
      let fail = true;
      const { client } = fakeClient({ [`GET ${endpoint}`]: () => (fail ? { status: 500 } : { data: { [listKey]: [assignment('a1')] } }) });
      mount(client);

      expect(await screen.findByRole('alert')).toHaveTextContent(kind.loadError);
      fail = false;
      await userEvent.click(screen.getByRole('button', { name: 'Erneut laden' }));

      expect(await screen.findByRole('rowheader', { name: 'mueller' })).toBeInTheDocument();
    });

    it('ohne Recht gibt es weder Formular noch Aktionen und die Lehrkraefte-Auswahl wird nicht geladen', async () => {
      const { client, calls } = fakeClient({ ...listRoute([assignment('a1', MUELLER, { status: 'upcoming' })]), ...teachersRoute() });
      mount(client);

      await screen.findByRole('rowheader', { name: 'mueller' });
      expect(screen.queryByRole('form', { name: kind.createForm })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Beenden|Löschen/ })).not.toBeInTheDocument();
      expect(calls.some((c) => c.url === TEACHERS_ENDPOINT)).toBe(false);
    });

    it('einem archivierten Elternobjekt wird nichts neu zugeordnet: kein Formular, aber Beenden bleibt', async () => {
      const { client } = fakeClient({ ...listRoute([assignment('a1')]), ...teachersRoute() });
      mount(client, { canManage: true, archived: true });

      await screen.findByRole('rowheader', { name: 'mueller' });
      expect(screen.queryByRole('form', { name: kind.createForm })).not.toBeInTheDocument();
      expect(screen.getByText(kind.archived)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Beenden: mueller' })).toBeInTheDocument();
    });
  });

  describe('zuordnen', () => {
    it('ordnet mit Standard-Gueltigkeitszeitraum zu: nur die Lehrkraft wird gesendet, danach laedt die Liste neu', async () => {
      const items: unknown[] = [];
      const { client, calls } = fakeClient({
        [`GET ${endpoint}`]: () => ({ data: { [listKey]: items } }),
        ...teachersRoute(),
        [`POST ${endpoint}`]: (call: FakeCall) => {
          items.push(assignment('a1', MUELLER));
          return { status: 201, data: { echo: call.data } };
        }
      });
      mount(client, { canManage: true });

      const form = await screen.findByRole('form', { name: kind.createForm });
      expect(within(screen.getByLabelText('Lehrkraft')).getAllByRole('option').map((o) => o.textContent)).toEqual(['Lehrkraft wählen', 'mueller (mueller@example.test)', 'schmidt']);
      expect(within(form).getByRole('button', { name: 'Zuordnen' })).toBeDisabled();
      await userEvent.selectOptions(screen.getByLabelText('Lehrkraft'), 't1');
      await userEvent.click(within(form).getByRole('button', { name: 'Zuordnen' }));

      expect(await screen.findByRole('status')).toHaveTextContent(kind.created);
      expect(calls.find((c) => c.method === 'POST')?.data).toEqual({ [parentKey]: parentId, teacher_id: 't1' });
      expect(await screen.findByRole('rowheader', { name: 'mueller' })).toBeInTheDocument();
    });

    it('sendet Beginn und Ende, wenn sie angegeben sind', async () => {
      const { client, calls } = fakeClient({ ...listRoute([]), ...teachersRoute(), [`POST ${endpoint}`]: { status: 201, data: {} } });
      mount(client, { canManage: true });
      await screen.findByRole('form', { name: kind.createForm });

      await userEvent.selectOptions(screen.getByLabelText('Lehrkraft'), 't2');
      await userEvent.type(screen.getByLabelText('Beginn'), '2026-10-01');
      await userEvent.type(screen.getByLabelText('Ende (einschließlich)'), '2026-12-18');
      await userEvent.click(screen.getByRole('button', { name: 'Zuordnen' }));

      await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.data).toEqual({ [parentKey]: parentId, teacher_id: 't2', starts_on: '2026-10-01', ends_on: '2026-12-18' }));
    });

    it('sperrt das Absenden bei einem Ende vor dem Beginn und nennt den Grund', async () => {
      const { client } = fakeClient({ ...listRoute([]), ...teachersRoute() });
      mount(client, { canManage: true });
      await screen.findByRole('form', { name: kind.createForm });

      await userEvent.selectOptions(screen.getByLabelText('Lehrkraft'), 't1');
      await userEvent.type(screen.getByLabelText('Beginn'), '2026-10-02');
      await userEvent.type(screen.getByLabelText('Ende (einschließlich)'), '2026-10-01');

      expect(screen.getByRole('alert')).toHaveTextContent('Das Ende darf nicht vor dem Beginn liegen.');
      expect(screen.getByRole('button', { name: 'Zuordnen' })).toBeDisabled();
    });

    it('uebersetzt die Ablehnungen der API in Hinweise mit den Worten der Art', async () => {
      let code = 'assignment_overlap';
      const { client } = fakeClient({ ...listRoute([]), ...teachersRoute(), [`POST ${endpoint}`]: () => ({ status: 409, data: { code, error: 'x' } }) });
      mount(client, { canManage: true });
      await screen.findByRole('form', { name: kind.createForm });
      await userEvent.selectOptions(screen.getByLabelText('Lehrkraft'), 't1');

      await userEvent.click(screen.getByRole('button', { name: 'Zuordnen' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Gültigkeitszeiträume derselben Lehrkraft dürfen sich nicht überschneiden');

      code = 'assignment_limit_reached';
      await userEvent.click(screen.getByRole('button', { name: 'Zuordnen' }));
      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(kind.limit));
    });

    it('weist darauf hin, wenn es keine waehlbare Lehrkraft gibt', async () => {
      const { client } = fakeClient({ ...listRoute([]), ...teachersRoute([]) });
      mount(client, { canManage: true });

      expect(await screen.findByText(/Es gibt noch keine wählbare Lehrkraft/)).toBeInTheDocument();
    });
  });

  describe('beenden und loeschen', () => {
    it('beendet mit einem Datum: ein Formular zur Zuordnung, gesendet wird das Ende, danach laedt die Liste neu', async () => {
      const { client, calls } = fakeClient({ ...listRoute([assignment('a1')]), ...teachersRoute(), [`POST ${endpoint}/a1/end`]: { data: {} } });
      mount(client, { canManage: true });

      await userEvent.click(await screen.findByRole('button', { name: 'Beenden: mueller' }));
      const form = screen.getByRole('form', { name: kind.endForm });
      await userEvent.type(within(form).getByLabelText('Letzter Tag (leer: heute)'), '2026-12-18');
      await userEvent.click(within(form).getByRole('button', { name: 'Beenden' }));

      expect(await screen.findByRole('status')).toHaveTextContent(kind.ended);
      expect(calls.find((c) => c.url === `${endpoint}/a1/end`)?.data).toEqual({ ends_on: '2026-12-18' });
      expect(screen.queryByRole('form', { name: kind.endForm })).not.toBeInTheDocument();
    });

    it('beendet ohne Datum zum heutigen Tag (leerer Body)', async () => {
      const { client, calls } = fakeClient({ ...listRoute([assignment('a1')]), ...teachersRoute(), [`POST ${endpoint}/a1/end`]: { data: {} } });
      mount(client, { canManage: true });

      await userEvent.click(await screen.findByRole('button', { name: 'Beenden: mueller' }));
      await userEvent.click(within(screen.getByRole('form', { name: kind.endForm })).getByRole('button', { name: 'Beenden' }));

      await waitFor(() => expect(calls.find((c) => c.url === `${endpoint}/a1/end`)?.data).toEqual({}));
    });

    it('zeigt die Ablehnung beim Beenden und laesst das Formular offen', async () => {
      const { client } = fakeClient({
        ...listRoute([assignment('a1')]),
        ...teachersRoute(),
        [`POST ${endpoint}/a1/end`]: { status: 409, data: { code: 'assignment_applied', error: 'x' } }
      });
      mount(client, { canManage: true });

      await userEvent.click(await screen.findByRole('button', { name: 'Beenden: mueller' }));
      await userEvent.click(within(screen.getByRole('form', { name: kind.endForm })).getByRole('button', { name: 'Beenden' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('frühestens heute');
      expect(screen.getByRole('form', { name: kind.endForm })).toBeInTheDocument();
    });

    it('bietet Beenden nur fuer nicht beendete und Loeschen nur fuer kommende Zuordnungen an', async () => {
      const { client } = fakeClient({
        ...listRoute([
          assignment('a1', MUELLER, { status: 'ended', ends_on: '2026-10-01', last_day: '2026-10-01' }),
          assignment('a2', SCHMIDT, { status: 'upcoming', starts_on: '2027-01-11' }),
          assignment('a3', { id: 't3', login_name: 'weber' }, { status: 'running' })
        ]),
        ...teachersRoute()
      });
      mount(client, { canManage: true });
      await screen.findByRole('rowheader', { name: 'schmidt' });

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
        [`POST ${endpoint}/a2/delete`]: { data: { deleted: true, id: 'a2' } }
      });
      mount(client, { canManage: true });

      await userEvent.click(await screen.findByRole('button', { name: 'Löschen: schmidt' }));
      expect(calls.some((c) => c.method === 'POST')).toBe(false);
      const dialog = await screen.findByRole('dialog');
      expect(dialog).toHaveTextContent(kind.deleteTitle);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Löschen' }));

      expect(await screen.findByRole('status')).toHaveTextContent(kind.deleted);
      expect(calls.some((c) => c.method === 'POST' && c.url === `${endpoint}/a2/delete`)).toBe(true);
    });

    it('bricht das Loeschen ab, ohne etwas zu senden', async () => {
      const { client, calls } = fakeClient({ ...listRoute([assignment('a2', SCHMIDT, { status: 'upcoming' })]), ...teachersRoute() });
      mount(client, { canManage: true });

      await userEvent.click(await screen.findByRole('button', { name: 'Löschen: schmidt' }));
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Abbrechen' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(calls.some((c) => c.method === 'POST')).toBe(false);
    });
  });
});
