import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import ClassesPage from './ClassesPage';
import { fakeClient, type FakeCall } from '../test/fakeHttp';

const Y2526 = { id: 'sy-1', name: '2025/26', starts_on: '2025-09-01', ends_on: '2026-07-31', status: 'past' };
const Y2627 = { id: 'sy-2', name: '2026/27', starts_on: '2026-09-14', ends_on: '2027-07-29', status: 'running' };
const Y2728 = { id: 'sy-3', name: '2027/28', starts_on: '2027-09-13', ends_on: '2028-07-28', status: 'upcoming' };

const klass = (id: string, grade_level: number, name: string, year = Y2627) => ({ id, grade_level, name, school_year: { id: year.id, name: year.name } });

const yearsRoute = (...years: unknown[]) => ({ 'GET /api/classes/school-years': { data: { school_years: years } } });
const classesRoute = (byYear: Record<string, unknown[]>) => ({
  'GET /api/classes': (call: FakeCall) => ({ data: { classes: byYear[String(call.params?.school_year_id)] ?? [] } })
});

describe('Klassen: Schuljahr-Auswahl und Liste', () => {
  it('zeigt Ladehinweise, waehlt das laufende Schuljahr vor und listet seine Klassen in der Reihenfolge der API', async () => {
    const { client, calls } = fakeClient({
      ...yearsRoute(Y2526, Y2627, Y2728),
      ...classesRoute({ 'sy-2': [klass('c1', 7, '7a'), klass('c2', 7, '7b'), klass('c3', 10, '10a')] })
    });
    render(<ClassesPage apiClient={client} canManage={false} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Klassen' })).toBeInTheDocument();
    expect(screen.getByText('Schuljahre werden geladen …')).toBeInTheDocument();

    const select = await screen.findByLabelText('Schuljahr');
    expect(select).toHaveValue('sy-2');
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['2025/26 (vergangen)', '2026/27 (laufend)', '2027/28 (kommend)']);
    const row = (await screen.findByRole('rowheader', { name: '7a' })).closest('tr')!;
    expect(within(row).getByText('7')).toHaveAttribute('data-label', 'Klassenstufe');
    expect(screen.getAllByRole('rowheader').map((h) => h.textContent)).toEqual(['7a', '7b', '10a']);
    expect(calls.filter((c) => c.url === '/api/classes')[0].params).toEqual({ school_year_id: 'sy-2' });
  });

  it('waehlt ohne laufendes Schuljahr das zuletzt vergangene vor', async () => {
    const { client } = fakeClient({ ...yearsRoute(Y2526, { ...Y2627, status: 'past' }), ...classesRoute({}) });
    render(<ClassesPage apiClient={client} canManage={false} />);

    expect(await screen.findByLabelText('Schuljahr')).toHaveValue('sy-2');
  });

  it('laedt die Klassen eines anderen Schuljahres nach der Auswahl', async () => {
    const { client } = fakeClient({
      ...yearsRoute(Y2526, Y2627),
      ...classesRoute({ 'sy-2': [klass('c1', 7, '7a')], 'sy-1': [klass('c9', 8, '8z', Y2526)] })
    });
    render(<ClassesPage apiClient={client} canManage={false} />);
    await screen.findByRole('rowheader', { name: '7a' });

    await userEvent.selectOptions(screen.getByLabelText('Schuljahr'), 'sy-1');

    expect(await screen.findByRole('rowheader', { name: '8z' })).toBeInTheDocument();
    expect(screen.queryByRole('rowheader', { name: '7a' })).not.toBeInTheDocument();
  });

  it('sagt, wenn das Schuljahr noch keine Klasse hat', async () => {
    const { client } = fakeClient({ ...yearsRoute(Y2627), ...classesRoute({}) });
    render(<ClassesPage apiClient={client} canManage={false} />);

    expect(await screen.findByText('In diesem Schuljahr gibt es noch keine Klasse.')).toBeInTheDocument();
  });

  it('sagt, wenn es noch kein Schuljahr gibt, und fragt keine Klassen ab', async () => {
    const { client, calls } = fakeClient(yearsRoute());
    render(<ClassesPage apiClient={client} canManage />);

    expect(await screen.findByText(/Es gibt noch kein Schuljahr/)).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Klasse anlegen' })).not.toBeInTheDocument();
    expect(calls.some((c) => c.url === '/api/classes')).toBe(false);
  });

  it('zeigt bei einem Fehler beim Laden der Schuljahre eine Meldung und laedt auf Wunsch erneut', async () => {
    let attempts = 0;
    const { client } = fakeClient({
      'GET /api/classes/school-years': () => (++attempts === 1 ? { status: 500 } : { data: { school_years: [Y2627] } }),
      ...classesRoute({})
    });
    render(<ClassesPage apiClient={client} canManage={false} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Die Schuljahre konnten nicht geladen werden');
    await userEvent.click(screen.getByRole('button', { name: 'Erneut laden' }));

    expect(await screen.findByLabelText('Schuljahr')).toHaveValue('sy-2');
  });

  it('zeigt bei einem Fehler beim Laden der Klassen eine Meldung und laedt auf Wunsch erneut', async () => {
    let attempts = 0;
    const { client } = fakeClient({
      ...yearsRoute(Y2627),
      'GET /api/classes': () => (++attempts === 1 ? { status: 500 } : { data: { classes: [klass('c1', 7, '7a')] } })
    });
    render(<ClassesPage apiClient={client} canManage={false} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Die Klassen konnten nicht geladen werden');
    expect(screen.getByLabelText('Schuljahr')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Erneut laden' }));

    expect(await screen.findByRole('rowheader', { name: '7a' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('braucht nur das Lesen: ohne Recht Klassen verwalten gibt es kein Formular', async () => {
    const { client, calls } = fakeClient({ ...yearsRoute(Y2627), ...classesRoute({ 'sy-2': [klass('c1', 7, '7a')] }) });
    render(<ClassesPage apiClient={client} canManage={false} />);

    await screen.findByRole('rowheader', { name: '7a' });
    expect(screen.queryByRole('form', { name: 'Klasse anlegen' })).not.toBeInTheDocument();
    expect(calls.every((c) => c.url !== '/api/school-years')).toBe(true);
  });
});

describe('Klassen: Anlegen', () => {
  const setup = (extra: Record<string, Parameters<typeof fakeClient>[0][string]> = {}) => {
    const byYear: Record<string, unknown[]> = { 'sy-2': [klass('c1', 7, '7a')] };
    const { client, calls } = fakeClient({
      ...yearsRoute(Y2526, Y2627),
      'GET /api/classes': (call: FakeCall) => ({ data: { classes: byYear[String(call.params?.school_year_id)] ?? [] } }),
      'POST /api/classes': (call: FakeCall) => {
        const body = call.data as { school_year_id: string; grade_level: number; name: string };
        const created = klass('c-new', body.grade_level, body.name.trim());
        byYear[body.school_year_id] = [...(byYear[body.school_year_id] ?? []), created];
        return { status: 201, data: { class: created } };
      },
      ...extra
    });
    render(<ClassesPage apiClient={client} canManage />);
    return { calls, writes: () => calls.filter((c) => c.method !== 'GET') };
  };

  const fill = async (grade: string, name: string) => {
    const form = screen.getByRole('form', { name: 'Klasse anlegen' });
    const gradeInput = within(form).getByLabelText('Klassenstufe');
    await userEvent.clear(gradeInput);
    if (grade) {
      await userEvent.type(gradeInput, grade);
    }
    await userEvent.type(within(form).getByLabelText('Bezeichnung'), name);
    return form;
  };

  it('zeigt das Formular mit dem Recht Klassen verwalten und sperrt Anlegen, solange Eingaben fehlen', async () => {
    setup();
    await screen.findByRole('rowheader', { name: '7a' });

    const form = screen.getByRole('form', { name: 'Klasse anlegen' });
    expect(within(form).getByRole('button', { name: 'Anlegen' })).toBeDisabled();
    await fill('7', 'b');
    expect(within(form).getByRole('button', { name: 'Anlegen' })).toBeEnabled();
  });

  it.each([['0', '7a', /ganze Zahl von 1 bis 13/], ['14', '7a', /ganze Zahl von 1 bis 13/], ['', '7a', /ganze Zahl von 1 bis 13/], ['7', '123456789012345678901', /höchstens 20 Zeichen/]])(
    'warnt bei Stufe "%s" und Bezeichnung "%s" und schickt nichts ab',
    async (grade, name, hint) => {
      const { writes } = setup();
      await screen.findByRole('rowheader', { name: '7a' });

      const form = await fill(grade, name);

      expect(within(form).getByText(hint)).toBeInTheDocument();
      expect(within(form).getByRole('button', { name: 'Anlegen' })).toBeDisabled();
      expect(writes()).toHaveLength(0);
    }
  );

  it('legt die Klasse im gewaehlten Schuljahr an, meldet sie, laedt die Liste neu und leert die Bezeichnung', async () => {
    const { writes } = setup();
    await screen.findByRole('rowheader', { name: '7a' });

    const form = await fill('7', '  7b ');
    await userEvent.click(within(form).getByRole('button', { name: 'Anlegen' }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatchObject({ method: 'POST', url: '/api/classes', data: { school_year_id: 'sy-2', grade_level: 7, name: '7b' } });
    expect(Object.keys(writes()[0].data as object).sort()).toEqual(['grade_level', 'name', 'school_year_id']);
    expect(await screen.findByRole('status')).toHaveTextContent('Klasse 7b angelegt.');
    expect(await screen.findByRole('rowheader', { name: '7b' })).toBeInTheDocument();
    expect(within(form).getByLabelText('Bezeichnung')).toHaveValue('');
    expect(within(form).getByLabelText('Klassenstufe')).toHaveValue(7);
  });

  it('legt die Klasse im Schuljahr an, das gerade gewaehlt ist', async () => {
    const { writes } = setup();
    await screen.findByRole('rowheader', { name: '7a' });
    await userEvent.selectOptions(screen.getByLabelText('Schuljahr'), 'sy-1');

    const form = await fill('5', '5a');
    await userEvent.click(within(form).getByRole('button', { name: 'Anlegen' }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0].data).toMatchObject({ school_year_id: 'sy-1', grade_level: 5, name: '5a' });
  });

  it('uebersetzt die Ablehnung wegen doppelter Bezeichnung, behaelt die Eingaben und laedt neu', async () => {
    const { calls } = setup({ 'POST /api/classes': { status: 409, data: { error: 'x', code: 'class_name_taken' } } });
    await screen.findByRole('rowheader', { name: '7a' });

    const form = await fill('7', '7A');
    await userEvent.click(within(form).getByRole('button', { name: 'Anlegen' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('bereits eine Klasse mit dieser Bezeichnung');
    expect(within(form).getByLabelText('Bezeichnung')).toHaveValue('7A');
    await waitFor(() => expect(calls.filter((c) => c.method === 'GET' && c.url === '/api/classes')).toHaveLength(2));
  });

  it('zeigt bei einem unbekannten Fehler den allgemeinen Text', async () => {
    setup({ 'POST /api/classes': { status: 500 } });
    await screen.findByRole('rowheader', { name: '7a' });

    const form = await fill('7', '7b');
    await userEvent.click(within(form).getByRole('button', { name: 'Anlegen' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Die Klasse konnte nicht angelegt werden');
  });
});
