import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import TeachingGroupsPage from './TeachingGroupsPage';
import { fakeClient, type FakeCall } from '../test/fakeHttp';

const Y2526 = { id: 'sy-1', name: '2025/26', starts_on: '2025-09-01', ends_on: '2026-07-31', status: 'past' };
const Y2627 = { id: 'sy-2', name: '2026/27', starts_on: '2026-09-14', ends_on: '2027-07-29', status: 'running' };

const MA = { id: 'su-ma', code: 'Ma', name: 'Mathematik' };
const EN = { id: 'su-en', code: 'En', name: 'Englisch' };
const klass = (id: string, grade_level: number, name: string, archived = false, year = Y2627) => ({ id, grade_level, name, archived, school_year: { id: year.id, name: year.name } });
const C7A = klass('c1', 7, '7a');
const C7B = klass('c2', 7, '7b');
const group = (id: string, name: string, subject = MA, classes = [C7A], year = Y2627) => ({ id, name, school_year: { id: year.id, name: year.name }, subject, classes });

const yearsRoute = (...years: unknown[]) => ({ 'GET /api/teaching-groups/school-years': { data: { school_years: years } } });
const groupsRoute = (byYear: Record<string, unknown[]>) => ({
  'GET /api/teaching-groups': (call: FakeCall) => ({ data: { teaching_groups: byYear[String(call.params?.school_year_id)] ?? [] } })
});

describe('Fachgruppen: Schuljahr-Auswahl und Liste', () => {
  it('zeigt Ladehinweise, waehlt das laufende Schuljahr vor und listet Fachgruppen mit Fach und Klassen in der Reihenfolge der API', async () => {
    const { client, calls } = fakeClient({
      ...yearsRoute(Y2526, Y2627),
      ...groupsRoute({ 'sy-2': [group('g1', 'AES 1', EN, [C7A, C7B]), group('g2', 'Ma 7')] })
    });
    render(<TeachingGroupsPage apiClient={client} canManage={false} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Fachgruppen' })).toBeInTheDocument();
    expect(screen.getByText('Schuljahre werden geladen …')).toBeInTheDocument();

    const select = await screen.findByLabelText('Schuljahr');
    expect(select).toHaveValue('sy-2');
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['2025/26 (vergangen)', '2026/27 (laufend)']);
    const row = (await screen.findByRole('rowheader', { name: 'AES 1' })).closest('tr')!;
    expect(within(row).getByText('En')).toHaveAttribute('data-label', 'Fach');
    expect(within(row).getByText('7a, 7b')).toHaveAttribute('data-label', 'Klassen');
    expect(screen.getAllByRole('rowheader').map((h) => h.textContent)).toEqual(['AES 1', 'Ma 7']);
    expect(calls.filter((c) => c.url === '/api/teaching-groups')[0].params).toEqual({ school_year_id: 'sy-2' });
  });

  it('laedt die Fachgruppen eines anderen Schuljahres nach der Auswahl', async () => {
    const { client } = fakeClient({
      ...yearsRoute(Y2526, Y2627),
      ...groupsRoute({ 'sy-2': [group('g1', 'Ma 7')], 'sy-1': [group('g9', 'Alt 1', MA, [klass('c9', 8, '8a', false, Y2526)], Y2526)] })
    });
    render(<TeachingGroupsPage apiClient={client} canManage={false} />);
    await screen.findByRole('rowheader', { name: 'Ma 7' });

    await userEvent.selectOptions(screen.getByLabelText('Schuljahr'), 'sy-1');

    expect(await screen.findByRole('rowheader', { name: 'Alt 1' })).toBeInTheDocument();
    expect(screen.queryByRole('rowheader', { name: 'Ma 7' })).not.toBeInTheDocument();
  });

  it('markiert eine archivierte Klasse in der Fachgruppe', async () => {
    const { client } = fakeClient({ ...yearsRoute(Y2627), ...groupsRoute({ 'sy-2': [group('g1', 'Ma 7', MA, [C7A, klass('c2', 7, '7b', true)])] }) });
    render(<TeachingGroupsPage apiClient={client} canManage={false} />);

    expect(await screen.findByText('7a, 7b (archiviert)')).toBeInTheDocument();
  });

  it('sagt, wenn das Schuljahr noch keine Fachgruppe hat', async () => {
    const { client } = fakeClient({ ...yearsRoute(Y2627), ...groupsRoute({}) });
    render(<TeachingGroupsPage apiClient={client} canManage={false} />);

    expect(await screen.findByText('In diesem Schuljahr gibt es noch keine Fachgruppe.')).toBeInTheDocument();
  });

  it('sagt, wenn es noch kein Schuljahr gibt, und fragt keine Fachgruppen ab', async () => {
    const { client, calls } = fakeClient(yearsRoute());
    render(<TeachingGroupsPage apiClient={client} canManage />);

    expect(await screen.findByText(/Es gibt noch kein Schuljahr/)).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Fachgruppe anlegen' })).not.toBeInTheDocument();
    expect(calls.some((c) => c.url === '/api/teaching-groups')).toBe(false);
  });

  it('zeigt bei einem Fehler beim Laden der Schuljahre eine Meldung und laedt auf Wunsch erneut', async () => {
    let attempts = 0;
    const { client } = fakeClient({
      'GET /api/teaching-groups/school-years': () => (++attempts === 1 ? { status: 500 } : { data: { school_years: [Y2627] } }),
      ...groupsRoute({})
    });
    render(<TeachingGroupsPage apiClient={client} canManage={false} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Die Schuljahre konnten nicht geladen werden');
    await userEvent.click(screen.getByRole('button', { name: 'Erneut laden' }));

    expect(await screen.findByLabelText('Schuljahr')).toHaveValue('sy-2');
  });

  it('zeigt bei einem Fehler beim Laden der Fachgruppen eine Meldung und laedt auf Wunsch erneut', async () => {
    let attempts = 0;
    const { client } = fakeClient({
      ...yearsRoute(Y2627),
      'GET /api/teaching-groups': () => (++attempts === 1 ? { status: 500 } : { data: { teaching_groups: [group('g1', 'Ma 7')] } })
    });
    render(<TeachingGroupsPage apiClient={client} canManage={false} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Die Fachgruppen konnten nicht geladen werden');
    await userEvent.click(screen.getByRole('button', { name: 'Erneut laden' }));

    expect(await screen.findByRole('rowheader', { name: 'Ma 7' })).toBeInTheDocument();
  });

  it('braucht nur das Lesen: ohne Recht Fachgruppen verwalten gibt es kein Formular und keine Abfrage der Auswahl', async () => {
    const { client, calls } = fakeClient({ ...yearsRoute(Y2627), ...groupsRoute({ 'sy-2': [group('g1', 'Ma 7')] }) });
    render(<TeachingGroupsPage apiClient={client} canManage={false} />);

    await screen.findByRole('rowheader', { name: 'Ma 7' });
    expect(screen.queryByRole('form', { name: 'Fachgruppe anlegen' })).not.toBeInTheDocument();
    expect(calls.some((c) => c.url === '/api/teaching-groups/choices')).toBe(false);
  });
});

describe('Fachgruppen: Detailansicht', () => {
  const setup = () => {
    const detail = group('g1', 'AES 1', EN, [C7A, klass('c2', 7, '7b', true)]);
    const { client, calls } = fakeClient({
      ...yearsRoute(Y2627),
      ...groupsRoute({ 'sy-2': [detail, group('g2', 'Ma 7')] }),
      'GET /api/teaching-groups/g1': { data: { teaching_group: detail } },
      'GET /api/teaching-groups/missing': { status: 404, data: { error: 'x', code: 'teaching_group_not_found' } }
    });
    render(<TeachingGroupsPage apiClient={client} canManage={false} />);
    return calls;
  };

  it('oeffnet die Detailansicht mit Schuljahr, Fach und den Klassen und geht zurueck zur Liste', async () => {
    const calls = setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Details: AES 1' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Fachgruppe AES 1' })).toBeInTheDocument();
    expect(calls.some((c) => c.url === '/api/teaching-groups/g1')).toBe(true);
    const detail = screen.getByRole('main');
    expect(within(detail).getByText('2026/27')).toBeInTheDocument();
    expect(within(detail).getByText('En – Englisch')).toBeInTheDocument();
    expect(within(detail).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['7a (Klassenstufe 7)', '7b (Klassenstufe 7, archiviert)']);

    await userEvent.click(screen.getByRole('button', { name: 'Zurück zu den Fachgruppen' }));

    expect(await screen.findByRole('rowheader', { name: 'Ma 7' })).toBeInTheDocument();
    expect(screen.getByLabelText('Schuljahr')).toHaveValue('sy-2');
  });
});

describe('Fachgruppen: Detailansicht einer archivierten Fachgruppe', () => {
  it('markiert die archivierte Fachgruppe in der Detailansicht', async () => {
    const detail = { ...group('g1', 'AES 1', EN), archived: true };
    const { client } = fakeClient({
      ...yearsRoute(Y2627),
      'GET /api/teaching-groups': (call: FakeCall) => ({ data: { teaching_groups: call.params?.include_archived === 1 ? [detail] : [] } }),
      'GET /api/teaching-groups/g1': { data: { teaching_group: detail } }
    });
    render(<TeachingGroupsPage apiClient={client} canManage={false} />);
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Archivierte anzeigen' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Details: AES 1' }));

    const detailView = await screen.findByRole('main');
    expect(await within(detailView).findByText('Archiviert')).toBeInTheDocument();
  });
});

describe('Fachgruppen: Anlegen', () => {
  const setup = (extra: Record<string, Parameters<typeof fakeClient>[0][string]> = {}, choices = { subjects: [EN, MA], classes: [C7A, C7B] }) => {
    const byYear: Record<string, unknown[]> = { 'sy-2': [group('g1', 'Ma 7')] };
    const { client, calls } = fakeClient({
      ...yearsRoute(Y2526, Y2627),
      'GET /api/teaching-groups': (call: FakeCall) => ({ data: { teaching_groups: byYear[String(call.params?.school_year_id)] ?? [] } }),
      'GET /api/teaching-groups/choices': () => ({ data: choices }),
      'POST /api/teaching-groups': (call: FakeCall) => {
        const body = call.data as { school_year_id: string; subject_id: string; name: string; class_ids: string[] };
        const created = group('g-new', body.name.trim(), [EN, MA].find((s) => s.id === body.subject_id), [C7A, C7B].filter((c) => body.class_ids.includes(c.id)));
        byYear[body.school_year_id] = [...(byYear[body.school_year_id] ?? []), created];
        return { status: 201, data: { teaching_group: created } };
      },
      ...extra
    });
    render(<TeachingGroupsPage apiClient={client} canManage />);
    return { calls, writes: () => calls.filter((c) => c.method !== 'GET') };
  };

  const form = async () => within(await screen.findByRole('form', { name: 'Fachgruppe anlegen' }));

  it('laedt die Auswahl des gewaehlten Schuljahres und zeigt Fach als Auswahlfeld und Klassen als Ankreuzfelder', async () => {
    const { calls } = setup();
    const f = await form();

    await waitFor(() => expect(f.getByLabelText('Fach')).toBeInTheDocument());
    expect(calls.filter((c) => c.url === '/api/teaching-groups/choices')[0].params).toEqual({ school_year_id: 'sy-2' });
    await waitFor(() => expect(within(f.getByLabelText('Fach')).getAllByRole('option').map((o) => o.textContent)).toEqual(['Fach wählen', 'En – Englisch', 'Ma – Mathematik']));
    expect(f.getByRole('group', { name: 'Klassen' })).toBeInTheDocument();
    expect(f.getAllByRole('checkbox').map((c) => c.closest('label')?.textContent)).toEqual(['7a', '7b']);
    expect(f.getByRole('button', { name: 'Anlegen' })).toBeDisabled();
  });

  it.each([
    ['   ', 'Ma', ['7a'], /Bezeichnung an/],
    ['x'.repeat(41), 'Ma', ['7a'], /höchstens 40 Zeichen/],
    ['AES 1', '', ['7a'], /wählen Sie ein Fach/],
    ['AES 1', 'Ma', [], /mindestens eine Klasse/]
  ])('warnt bei Bezeichnung "%s", Fach "%s" und Klassen %j und schickt nichts ab', async (name, subject, classNames, hint) => {
    const { writes } = setup();
    const f = await form();
    await f.findByRole('option', { name: 'Ma – Mathematik' });

    await userEvent.type(f.getByLabelText('Bezeichnung'), name);
    if (subject) {
      await userEvent.selectOptions(f.getByLabelText('Fach'), 'su-ma');
    }
    for (const c of classNames) {
      await userEvent.click(f.getByLabelText(c));
    }

    expect(f.getByRole('alert')).toHaveTextContent(hint);
    expect(f.getByRole('button', { name: 'Anlegen' })).toBeDisabled();
    expect(writes()).toHaveLength(0);
  });

  it('legt die Fachgruppe mit Fach und mehreren Klassen im gewaehlten Schuljahr an, meldet sie und laedt die Liste neu', async () => {
    const { writes } = setup();
    const f = await form();
    await f.findByRole('option', { name: 'En – Englisch' });

    await userEvent.type(f.getByLabelText('Bezeichnung'), '  AES 1 ');
    await userEvent.selectOptions(f.getByLabelText('Fach'), 'su-en');
    await userEvent.click(f.getByLabelText('7a'));
    await userEvent.click(f.getByLabelText('7b'));
    await userEvent.click(f.getByRole('button', { name: 'Anlegen' }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatchObject({ method: 'POST', url: '/api/teaching-groups', data: { school_year_id: 'sy-2', subject_id: 'su-en', name: 'AES 1', class_ids: ['c1', 'c2'] } });
    expect(Object.keys(writes()[0].data as object).sort()).toEqual(['class_ids', 'name', 'school_year_id', 'subject_id']);
    expect(await screen.findByRole('status')).toHaveTextContent('Fachgruppe AES 1 angelegt.');
    expect(await screen.findByRole('rowheader', { name: 'AES 1' })).toBeInTheDocument();
    expect(f.getByLabelText('Bezeichnung')).toHaveValue('');
  });

  it('laedt die Auswahl neu und legt im Schuljahr an, das gerade gewaehlt ist', async () => {
    const { calls, writes } = setup();
    const f = await form();
    await f.findByRole('option', { name: 'Ma – Mathematik' });
    await userEvent.selectOptions(screen.getByLabelText('Schuljahr'), 'sy-1');
    await waitFor(() => expect(calls.filter((c) => c.url === '/api/teaching-groups/choices').map((c) => c.params)).toContainEqual({ school_year_id: 'sy-1' }));

    const again = await form();
    await again.findByRole('option', { name: 'Ma – Mathematik' });
    await userEvent.type(again.getByLabelText('Bezeichnung'), 'Alt 1');
    await userEvent.selectOptions(again.getByLabelText('Fach'), 'su-ma');
    await userEvent.click(again.getByLabelText('7a'));
    await userEvent.click(again.getByRole('button', { name: 'Anlegen' }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0].data).toMatchObject({ school_year_id: 'sy-1', name: 'Alt 1' });
  });

  it('zeigt den Text zum Fehlercode und laedt danach neu', async () => {
    const { calls } = setup({ 'POST /api/teaching-groups': { status: 409, data: { error: 'x', code: 'teaching_group_name_taken' } } });
    const f = await form();
    await f.findByRole('option', { name: 'Ma – Mathematik' });

    await userEvent.type(f.getByLabelText('Bezeichnung'), 'Ma 7');
    await userEvent.selectOptions(f.getByLabelText('Fach'), 'su-ma');
    await userEvent.click(f.getByLabelText('7a'));
    const before = calls.filter((c) => c.url === '/api/teaching-groups' && c.method === 'GET').length;
    await userEvent.click(f.getByRole('button', { name: 'Anlegen' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('bereits eine Fachgruppe mit dieser Bezeichnung');
    await waitFor(() => expect(calls.filter((c) => c.url === '/api/teaching-groups' && c.method === 'GET').length).toBeGreaterThan(before));
    expect(f.getByLabelText('Bezeichnung')).toHaveValue('Ma 7');
  });

  it('weist darauf hin, wenn es kein waehlbares Fach oder keine waehlbare Klasse gibt', async () => {
    setup({}, { subjects: [], classes: [] });
    const f = await form();

    expect(await f.findByText(/noch kein wählbares Fach/)).toBeInTheDocument();
    expect(f.getByText(/noch keine wählbare Klasse/)).toBeInTheDocument();
    expect(f.getByRole('button', { name: 'Anlegen' })).toBeDisabled();
  });

  it('zeigt bei einem Fehler beim Laden der Auswahl eine Meldung und laedt auf Wunsch erneut', async () => {
    let attempts = 0;
    setup({ 'GET /api/teaching-groups/choices': () => (++attempts === 1 ? { status: 500 } : { data: { subjects: [MA], classes: [C7A] } }) });
    const f = await form();

    expect(await f.findByText('Die Auswahl für Fach und Klassen konnte nicht geladen werden.')).toBeInTheDocument();
    await userEvent.click(f.getByRole('button', { name: 'Erneut laden' }));

    expect(await f.findByRole('option', { name: 'Ma – Mathematik' })).toBeInTheDocument();
  });
});
