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
