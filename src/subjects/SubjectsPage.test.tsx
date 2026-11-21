import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import SubjectsPage from './SubjectsPage';
import { fakeClient, type FakeCall } from '../test/fakeHttp';

const subject = (id: string, code: string, name: string) => ({ id, code, name });

describe('Faecher: Liste', () => {
  it('zeigt einen Ladehinweis und listet die Faecher in der Reihenfolge der API', async () => {
    const { client } = fakeClient({
      'GET /api/subjects': { data: { subjects: [subject('s1', 'Bi', 'Biologie'), subject('s2', 'D1', 'Deutsch'), subject('s3', 'Ev', 'Evangelische Religion')] } }
    });
    render(<SubjectsPage apiClient={client} canManage={false} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Fächer' })).toBeInTheDocument();
    expect(screen.getByText('Fächer werden geladen …')).toBeInTheDocument();

    const row = (await screen.findByRole('rowheader', { name: 'Bi' })).closest('tr')!;
    expect(within(row).getByText('Biologie')).toHaveAttribute('data-label', 'Bezeichnung');
    expect(screen.getAllByRole('rowheader').map((h) => h.textContent)).toEqual(['Bi', 'D1', 'Ev']);
  });

  it('sagt, wenn es noch kein Fach gibt', async () => {
    const { client } = fakeClient({ 'GET /api/subjects': { data: { subjects: [] } } });
    render(<SubjectsPage apiClient={client} canManage={false} />);

    expect(await screen.findByText('Es gibt noch kein Fach.')).toBeInTheDocument();
  });

  it('zeigt bei einem Ladefehler eine Meldung und laedt auf Wunsch erneut', async () => {
    let attempts = 0;
    const { client } = fakeClient({
      'GET /api/subjects': () => (++attempts === 1 ? { status: 500 } : { data: { subjects: [subject('s1', 'Bi', 'Biologie')] } })
    });
    render(<SubjectsPage apiClient={client} canManage={false} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Die Fächer konnten nicht geladen werden');
    await userEvent.click(screen.getByRole('button', { name: 'Erneut laden' }));

    expect(await screen.findByRole('rowheader', { name: 'Bi' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('braucht nur das Lesen: ohne Recht Faecher verwalten gibt es kein Formular', async () => {
    const { client } = fakeClient({ 'GET /api/subjects': { data: { subjects: [subject('s1', 'Bi', 'Biologie')] } } });
    render(<SubjectsPage apiClient={client} canManage={false} />);

    await screen.findByRole('rowheader', { name: 'Bi' });
    expect(screen.queryByRole('form', { name: 'Fach anlegen' })).not.toBeInTheDocument();
  });
});

describe('Faecher: Anlegen', () => {
  const setup = (extra: Record<string, Parameters<typeof fakeClient>[0][string]> = {}) => {
    let subjects = [subject('s1', 'Bi', 'Biologie')];
    const { client, calls } = fakeClient({
      'GET /api/subjects': () => ({ data: { subjects } }),
      'POST /api/subjects': (call: FakeCall) => {
        const body = call.data as { code: string; name: string };
        const created = subject('s-new', body.code, body.name);
        subjects = [...subjects, created];
        return { status: 201, data: { subject: created } };
      },
      ...extra
    });
    render(<SubjectsPage apiClient={client} canManage />);
    return { calls, writes: () => calls.filter((c) => c.method !== 'GET') };
  };

  const fill = async (code: string, name: string) => {
    const form = screen.getByRole('form', { name: 'Fach anlegen' });
    await userEvent.type(within(form).getByLabelText('Kürzel'), code);
    await userEvent.type(within(form).getByLabelText('Bezeichnung'), name);
    return form;
  };

  it('zeigt das Formular mit dem Recht Faecher verwalten und sperrt Anlegen, solange Eingaben fehlen', async () => {
    setup();
    await screen.findByRole('rowheader', { name: 'Bi' });

    const form = screen.getByRole('form', { name: 'Fach anlegen' });
    expect(within(form).getByRole('button', { name: 'Anlegen' })).toBeDisabled();
    await fill('Ma', 'Mathematik');
    expect(within(form).getByRole('button', { name: 'Anlegen' })).toBeEnabled();
  });

  it.each([['D E', 'Deutsch', /Kürzel/], ['12345678901', 'Deutsch', /Kürzel/], ['D', 'x'.repeat(61), /höchstens 60 Zeichen/]])(
    'warnt bei Kuerzel "%s" und Bezeichnung und schickt nichts ab',
    async (code, name, hint) => {
      const { writes } = setup();
      await screen.findByRole('rowheader', { name: 'Bi' });

      const form = await fill(code, name);

      expect(within(form).getByRole('alert')).toHaveTextContent(hint);
      expect(within(form).getByRole('button', { name: 'Anlegen' })).toBeDisabled();
      expect(writes()).toHaveLength(0);
    }
  );

  it('weist darauf hin, dass das Kuerzel nach dem Anlegen nicht mehr aenderbar ist', async () => {
    setup();
    await screen.findByRole('rowheader', { name: 'Bi' });

    expect(within(screen.getByRole('form', { name: 'Fach anlegen' })).getByText(/nicht mehr ändern/)).toBeInTheDocument();
  });

  it('legt das Fach an, meldet es, laedt die Liste neu und leert beide Felder', async () => {
    const { writes } = setup();
    await screen.findByRole('rowheader', { name: 'Bi' });

    const form = await fill('  Ma ', ' Mathematik ');
    await userEvent.click(within(form).getByRole('button', { name: 'Anlegen' }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatchObject({ method: 'POST', url: '/api/subjects', data: { code: 'Ma', name: 'Mathematik' } });
    expect(Object.keys(writes()[0].data as object).sort()).toEqual(['code', 'name']);
    expect(await screen.findByRole('status')).toHaveTextContent('Fach Ma angelegt.');
    expect(await screen.findByRole('rowheader', { name: 'Ma' })).toBeInTheDocument();
    expect(within(form).getByLabelText('Kürzel')).toHaveValue('');
    expect(within(form).getByLabelText('Bezeichnung')).toHaveValue('');
  });

  it('uebersetzt die Ablehnung wegen doppeltem Kuerzel, behaelt die Eingaben und laedt neu', async () => {
    const { calls } = setup({ 'POST /api/subjects': { status: 409, data: { error: 'x', code: 'subject_code_taken' } } });
    await screen.findByRole('rowheader', { name: 'Bi' });

    const form = await fill('BI', 'Noch eine Biologie');
    await userEvent.click(within(form).getByRole('button', { name: 'Anlegen' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('bereits ein Fach mit diesem Kürzel');
    expect(within(form).getByLabelText('Kürzel')).toHaveValue('BI');
    await waitFor(() => expect(calls.filter((c) => c.method === 'GET' && c.url === '/api/subjects')).toHaveLength(2));
  });

  it('zeigt bei einem unbekannten Fehler den allgemeinen Text', async () => {
    setup({ 'POST /api/subjects': { status: 500 } });
    await screen.findByRole('rowheader', { name: 'Bi' });

    const form = await fill('Ma', 'Mathematik');
    await userEvent.click(within(form).getByRole('button', { name: 'Anlegen' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Das Fach konnte nicht angelegt werden');
  });
});
