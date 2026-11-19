import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import SchoolYearsPage from './SchoolYearsPage';
import { fakeClient, type FakeCall } from '../test/fakeHttp';

const Y2526 = { id: 'sy-1', name: '2025/26', starts_on: '2025-09-01', ends_on: '2026-07-31', status: 'past' };
const Y2627 = { id: 'sy-2', name: '2026/27', starts_on: '2026-09-14', ends_on: '2027-07-29', status: 'running' };
const Y2728 = { id: 'sy-3', name: '2027/28', starts_on: '2027-09-13', ends_on: '2028-07-28', status: 'upcoming' };

const list = (...years: unknown[]) => ({ 'GET /api/school-years': { data: { school_years: years } } });

describe('Schuljahre: Liste', () => {
  it('zeigt waehrend des Ladens einen Hinweis und danach Bezeichnung, Zeitraum und Status-Badge in der Reihenfolge der API', async () => {
    const { client } = fakeClient(list(Y2526, Y2627, Y2728));
    render(<SchoolYearsPage apiClient={client} canManage={false} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Schuljahre' })).toBeInTheDocument();
    expect(screen.getByText('Schuljahre werden geladen …')).toBeInTheDocument();

    const row = (await screen.findByRole('rowheader', { name: '2026/27' })).closest('tr')!;
    expect(within(row).getByText('14.09.2026')).toBeInTheDocument();
    expect(within(row).getByText('29.07.2027')).toBeInTheDocument();
    expect(within(row).getByText('laufend')).toBeInTheDocument();
    const names = screen.getAllByRole('rowheader').map((h) => h.textContent);
    expect(names).toEqual(['2025/26', '2026/27', '2027/28']);
    expect(screen.getByText('vergangen')).toBeInTheDocument();
    expect(screen.getByText('kommend')).toBeInTheDocument();
  });

  it('kennzeichnet die Zellen mit ihrer Spalte, damit die Tabelle auf dem Smartphone als Karten erscheint', async () => {
    const { client } = fakeClient(list(Y2627));
    render(<SchoolYearsPage apiClient={client} canManage={false} />);

    const row = (await screen.findByRole('rowheader', { name: '2026/27' })).closest('tr')!;
    expect(within(row).getByText('14.09.2026').closest('td')).toHaveAttribute('data-label', 'Beginn');
    expect(within(row).getByText('29.07.2027').closest('td')).toHaveAttribute('data-label', 'Ende');
    expect(within(row).getByText('laufend').closest('td')).toHaveAttribute('data-label', 'Status');
  });

  it('sagt, wenn es noch kein Schuljahr gibt', async () => {
    const { client } = fakeClient(list());
    render(<SchoolYearsPage apiClient={client} canManage={false} />);

    expect(await screen.findByText('Es gibt noch kein Schuljahr.')).toBeInTheDocument();
  });

  it('zeigt bei einem Ladefehler eine Meldung und laedt auf Wunsch erneut', async () => {
    let attempts = 0;
    const { client } = fakeClient({
      'GET /api/school-years': () => (++attempts === 1 ? { status: 500 } : { data: { school_years: [Y2627] } })
    });
    render(<SchoolYearsPage apiClient={client} canManage={false} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Die Schuljahre konnten nicht geladen werden');
    await userEvent.click(screen.getByRole('button', { name: 'Erneut laden' }));

    expect(await screen.findByRole('rowheader', { name: '2026/27' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Schuljahre: Anlegen', () => {
  const setup = (extra: Record<string, Parameters<typeof fakeClient>[0][string]> = {}) => {
    let years: unknown[] = [Y2526];
    const { client, calls } = fakeClient({
      'GET /api/school-years': () => ({ data: { school_years: years } }),
      'POST /api/school-years': (call: FakeCall) => {
        const body = call.data as { starts_on: string; ends_on: string };
        const created = { id: 'sy-new', name: '2026/27', ...body, status: 'running' };
        years = [...years, created];
        return { status: 201, data: { school_year: created } };
      },
      ...extra
    });
    render(<SchoolYearsPage apiClient={client} canManage />);
    return { calls, writes: () => calls.filter((c) => c.method !== 'GET') };
  };

  const fill = async (start: string, end: string) => {
    const form = screen.getByRole('form', { name: 'Schuljahr anlegen' });
    await userEvent.type(within(form).getByLabelText('Beginn'), start);
    await userEvent.type(within(form).getByLabelText('Ende'), end);
    return form;
  };

  it('zeigt das Formular nur mit dem Recht Schuljahre verwalten', async () => {
    const { client } = fakeClient(list(Y2627));
    render(<SchoolYearsPage apiClient={client} canManage={false} />);

    await screen.findByRole('rowheader', { name: '2026/27' });
    expect(screen.queryByRole('form', { name: 'Schuljahr anlegen' })).not.toBeInTheDocument();
  });

  it('zeigt die Vorschau der Bezeichnung, sobald Beginn und Ende stehen, und bietet keine Eingabe dafuer', async () => {
    setup();
    await screen.findByRole('rowheader', { name: '2025/26' });

    const form = screen.getByRole('form', { name: 'Schuljahr anlegen' });
    expect(within(form).queryByLabelText(/Bezeichnung/)).not.toBeInTheDocument();
    expect(within(form).getByText(/Die Bezeichnung ergibt sich aus dem Zeitraum/)).toBeInTheDocument();

    await fill('2026-09-14', '2027-07-29');

    expect(within(form).getByText('2026/27', { selector: 'output' })).toBeInTheDocument();
  });

  it('warnt bei einem Ende ausserhalb des Folgejahres und sperrt das Anlegen', async () => {
    const { writes } = setup();
    await screen.findByRole('rowheader', { name: '2025/26' });

    const form = await fill('2026-09-14', '2026-12-31');

    expect(within(form).getByText('Das Ende muss im Kalenderjahr nach dem Beginn liegen.')).toBeInTheDocument();
    expect(within(form).getByRole('button', { name: 'Anlegen' })).toBeDisabled();
    expect(writes()).toHaveLength(0);
  });

  it('sperrt Anlegen, solange Beginn oder Ende fehlt', async () => {
    setup();
    await screen.findByRole('rowheader', { name: '2025/26' });

    expect(screen.getByRole('button', { name: 'Anlegen' })).toBeDisabled();
  });

  it('legt das Schuljahr an, meldet es mit Bezeichnung, laedt die Liste neu und leert das Formular', async () => {
    const { writes } = setup();
    await screen.findByRole('rowheader', { name: '2025/26' });

    const form = await fill('2026-09-14', '2027-07-29');
    await userEvent.click(within(form).getByRole('button', { name: 'Anlegen' }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatchObject({ method: 'POST', url: '/api/school-years', data: { starts_on: '2026-09-14', ends_on: '2027-07-29' } });
    expect(Object.keys(writes()[0].data as object).sort()).toEqual(['ends_on', 'starts_on']);
    expect(await screen.findByRole('status')).toHaveTextContent('Schuljahr 2026/27 angelegt.');
    expect(await screen.findByRole('rowheader', { name: '2026/27' })).toBeInTheDocument();
    expect(within(form).getByLabelText('Beginn')).toHaveValue('');
  });

  it('uebersetzt die Ablehnung wegen Ueberschneidung, behaelt die Eingaben und laedt neu', async () => {
    const { calls } = setup({ 'POST /api/school-years': { status: 409, data: { error: 'x', code: 'school_year_overlap' } } });
    await screen.findByRole('rowheader', { name: '2025/26' });

    const form = await fill('2026-07-01', '2027-07-29');
    await userEvent.click(within(form).getByRole('button', { name: 'Anlegen' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('überschneidet sich mit einem bestehenden Schuljahr');
    expect(within(form).getByLabelText('Beginn')).toHaveValue('2026-07-01');
    await waitFor(() => expect(calls.filter((c) => c.method === 'GET')).toHaveLength(2));
  });

  it('zeigt bei einem unbekannten Fehler den allgemeinen Text', async () => {
    setup({ 'POST /api/school-years': { status: 500 } });
    await screen.findByRole('rowheader', { name: '2025/26' });

    const form = await fill('2026-09-14', '2027-07-29');
    await userEvent.click(within(form).getByRole('button', { name: 'Anlegen' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Das Schuljahr konnte nicht angelegt werden');
  });
});

describe('Schuljahre: Detailansicht mit Klassen (Ticket #55)', () => {
  const klass = (id: string, grade_level: number, name: string) => ({ id, grade_level, name, school_year: { id: Y2627.id, name: Y2627.name } });
  const setup = (props: { canViewClasses?: boolean; canManageClasses?: boolean } = {}) => {
    const { client, calls } = fakeClient({
      ...list(Y2526, Y2627),
      'GET /api/classes': (call: FakeCall) => ({ data: { classes: call.params?.school_year_id === 'sy-2' ? [klass('c1', 7, '7a'), klass('c2', 10, '10a')] : [] } }),
      'POST /api/classes': (call: FakeCall) => ({ status: 201, data: { class: klass('c3', 7, '7b'), echo: call.data } })
    });
    render(<SchoolYearsPage apiClient={client} canManage={false} {...props} />);
    return { calls };
  };

  it('oeffnet ueber die Bezeichnung die Detailansicht mit Zeitraum, Status und den Klassen des Schuljahres', async () => {
    const { calls } = setup({ canViewClasses: true });

    await userEvent.click(await screen.findByRole('button', { name: '2026/27' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Schuljahr 2026/27' })).toBeInTheDocument();
    expect(screen.getByText('14.09.2026')).toBeInTheDocument();
    expect(screen.getByText('laufend')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Klassen' })).toBeInTheDocument();
    expect(await screen.findByRole('rowheader', { name: '7a' })).toBeInTheDocument();
    expect(screen.getAllByRole('rowheader').map((h) => h.textContent)).toEqual(['7a', '10a']);
    expect(calls.find((c) => c.url === '/api/classes')?.params).toEqual({ school_year_id: 'sy-2' });
    expect(screen.queryByRole('form', { name: 'Klasse anlegen' })).not.toBeInTheDocument();
  });

  it('fuehrt ueber „Zurueck“ in die Liste', async () => {
    setup({ canViewClasses: true });
    await userEvent.click(await screen.findByRole('button', { name: '2026/27' }));

    await userEvent.click(screen.getByRole('button', { name: 'Zurück zu den Schuljahren' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Schuljahre' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: '2025/26' })).toBeInTheDocument();
  });

  it('fragt ohne das Recht Klassen ansehen keine Klassen ab und erklaert das', async () => {
    const { calls } = setup({ canViewClasses: false });

    await userEvent.click(await screen.findByRole('button', { name: '2026/27' }));

    expect(screen.getByText(/Recht „Klassen ansehen“/)).toBeInTheDocument();
    expect(calls.some((c) => c.url === '/api/classes')).toBe(false);
  });

  it('bietet mit dem Recht Klassen verwalten das Anlegen im Schuljahr an', async () => {
    const { calls } = setup({ canViewClasses: true, canManageClasses: true });
    await userEvent.click(await screen.findByRole('button', { name: '2026/27' }));
    await screen.findByRole('rowheader', { name: '7a' });

    const form = screen.getByRole('form', { name: 'Klasse anlegen' });
    await userEvent.type(within(form).getByLabelText('Klassenstufe'), '7');
    await userEvent.type(within(form).getByLabelText('Bezeichnung'), '7b');
    await userEvent.click(within(form).getByRole('button', { name: 'Anlegen' }));

    await waitFor(() => expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1));
    expect(calls.find((c) => c.method === 'POST')?.data).toEqual({ school_year_id: 'sy-2', grade_level: 7, name: '7b' });
  });
});

describe('Schuljahre: Bearbeiten und Löschen (Ticket #56)', () => {
  const setup = (extra: Record<string, Parameters<typeof fakeClient>[0][string]> = {}, canManage = true) => {
    let years: Array<typeof Y2526> = [Y2526, Y2627];
    const { client, calls } = fakeClient({
      'GET /api/school-years': () => ({ data: { school_years: years } }),
      'POST /api/school-years/sy-2/update': (call: FakeCall) => {
        const body = call.data as { starts_on: string; ends_on: string };
        const updated = { ...Y2627, ...body, name: `${body.starts_on.slice(0, 4)}/${body.ends_on.slice(2, 4)}` };
        years = years.map((y) => (y.id === 'sy-2' ? updated : y));
        return { data: { school_year: updated } };
      },
      'POST /api/school-years/sy-2/delete': () => {
        years = years.filter((y) => y.id !== 'sy-2');
        return { data: { deleted: true, id: 'sy-2' } };
      },
      ...extra
    });
    render(<SchoolYearsPage apiClient={client} canManage={canManage} />);
    return { calls, writes: () => calls.filter((c) => c.method !== 'GET') };
  };

  const openEditor = async () => {
    await userEvent.click(await screen.findByRole('button', { name: 'Bearbeiten: 2026/27' }));
    return screen.getByRole('form', { name: 'Schuljahr bearbeiten' });
  };

  it('zeigt Bearbeiten und Löschen je Schuljahr nur mit dem Recht Schuljahre verwalten', async () => {
    setup({}, false);
    await screen.findByRole('rowheader', { name: '2026/27' });

    expect(screen.queryByRole('button', { name: /^Bearbeiten:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Löschen:/ })).not.toBeInTheDocument();
  });

  it('öffnet das Formular mit dem bisherigen Zeitraum und der Vorschau der Bezeichnung, ohne Eingabe dafür', async () => {
    setup();

    const form = await openEditor();

    expect(within(form).getByLabelText('Beginn')).toHaveValue('2026-09-14');
    expect(within(form).getByLabelText('Ende')).toHaveValue('2027-07-29');
    expect(within(form).getByText('2026/27', { selector: 'output' })).toBeInTheDocument();
    expect(within(form).queryByLabelText(/Bezeichnung/)).not.toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Schuljahr anlegen' })).toBeInTheDocument();
  });

  it('speichert den neuen Zeitraum, meldet die neue Bezeichnung, lädt neu und schließt das Formular', async () => {
    const { writes } = setup();
    const form = await openEditor();

    const start = within(form).getByLabelText('Beginn');
    await userEvent.clear(start);
    await userEvent.type(start, '2027-09-01');
    const end = within(form).getByLabelText('Ende');
    await userEvent.clear(end);
    await userEvent.type(end, '2028-07-31');
    expect(within(form).getByText('2027/28', { selector: 'output' })).toBeInTheDocument();
    await userEvent.click(within(form).getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatchObject({ method: 'POST', url: '/api/school-years/sy-2/update', data: { starts_on: '2027-09-01', ends_on: '2028-07-31' } });
    expect(Object.keys(writes()[0].data as object).sort()).toEqual(['ends_on', 'starts_on']);
    expect(await screen.findByRole('status')).toHaveTextContent('Schuljahr 2027/28 gespeichert.');
    expect(await screen.findByRole('rowheader', { name: '2027/28' })).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Schuljahr bearbeiten' })).not.toBeInTheDocument();
  });

  it('warnt bei einem Ende außerhalb des Folgejahres und sperrt das Speichern', async () => {
    const { writes } = setup();
    const form = await openEditor();

    const end = within(form).getByLabelText('Ende');
    await userEvent.clear(end);
    await userEvent.type(end, '2026-12-31');

    expect(within(form).getByText('Das Ende muss im Kalenderjahr nach dem Beginn liegen.')).toBeInTheDocument();
    expect(within(form).getByRole('button', { name: 'Speichern' })).toBeDisabled();
    expect(writes()).toHaveLength(0);
  });

  it('Abbrechen schließt das Formular, ohne etwas zu schreiben', async () => {
    const { writes } = setup();
    const form = await openEditor();

    await userEvent.click(within(form).getByRole('button', { name: 'Abbrechen' }));

    expect(screen.queryByRole('form', { name: 'Schuljahr bearbeiten' })).not.toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  });

  it('übersetzt die Ablehnung wegen Überschneidung, behält das Formular und lädt neu', async () => {
    const { calls } = setup({ 'POST /api/school-years/sy-2/update': { status: 409, data: { error: 'x', code: 'school_year_overlap' } } });
    const form = await openEditor();

    const start = within(form).getByLabelText('Beginn');
    await userEvent.clear(start);
    await userEvent.type(start, '2026-07-01');
    await userEvent.click(within(form).getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('überschneidet sich mit einem bestehenden Schuljahr');
    expect(screen.getByRole('form', { name: 'Schuljahr bearbeiten' })).toBeInTheDocument();
    expect(within(form).getByLabelText('Beginn')).toHaveValue('2026-07-01');
    await waitFor(() => expect(calls.filter((c) => c.method === 'GET')).toHaveLength(2));
  });

  it('zeigt den Einwand eines anderen Moduls mit dessen Meldung, wenn der Code unbekannt ist', async () => {
    setup({ 'POST /api/school-years/sy-2/update': { status: 409, data: { error: 'Der Stundenplan ist veröffentlicht.', code: 'timetable_published' } } });
    const form = await openEditor();

    await userEvent.click(within(form).getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Der Stundenplan ist veröffentlicht.');
  });

  it('löscht nach Bestätigung und meldet es', async () => {
    const { writes } = setup();

    await userEvent.click(await screen.findByRole('button', { name: 'Löschen: 2026/27' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Schuljahr „2026/27“ löschen?');
    expect(writes()).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Löschen' }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatchObject({ method: 'POST', url: '/api/school-years/sy-2/delete' });
    expect(await screen.findByRole('status')).toHaveTextContent('Schuljahr 2026/27 gelöscht.');
    await waitFor(() => expect(screen.queryByRole('rowheader', { name: '2026/27' })).not.toBeInTheDocument());
  });

  it('Abbrechen im Dialog löscht nichts', async () => {
    const { writes } = setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Löschen: 2026/27' }));

    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Abbrechen' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  });

  it('erklärt die Ablehnung, weil das Schuljahr Klassen hat (auch archivierte), und lädt neu', async () => {
    const { calls } = setup({ 'POST /api/school-years/sy-2/delete': { status: 409, data: { error: 'x', code: 'school_year_has_classes' } } });
    await userEvent.click(await screen.findByRole('button', { name: 'Löschen: 2026/27' }));

    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Löschen' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('hat Klassen, auch archivierte');
    expect(screen.getByRole('rowheader', { name: '2026/27' })).toBeInTheDocument();
    await waitFor(() => expect(calls.filter((c) => c.method === 'GET')).toHaveLength(2));
  });

  it('zeigt bei einem unbekannten Fehler den allgemeinen Text zum Löschen', async () => {
    setup({ 'POST /api/school-years/sy-2/delete': { status: 500 } });
    await userEvent.click(await screen.findByRole('button', { name: 'Löschen: 2026/27' }));

    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Löschen' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Das Schuljahr konnte nicht gelöscht werden');
  });
});
