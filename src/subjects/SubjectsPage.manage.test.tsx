import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { describe, expect, it } from 'vitest';
import SubjectsPage from './SubjectsPage';
import { describeSubjectFailure } from './subjects';
import { fakeClient, type FakeCall } from '../test/fakeHttp';

const subject = (id: string, code: string, name: string, archived = false) => ({ id, code, name, archived });

/** Fake-API mit zwei aktiven und einem archivierten Fach; Aktionen veraendern den Stand wie die echte API. */
function setup({ canManage = true, extra = {} }: { canManage?: boolean; extra?: Record<string, Parameters<typeof fakeClient>[0][string]> } = {}) {
  let subjects = [subject('s1', 'Bi', 'Biologie'), subject('s2', 'Ma', 'Mathematik'), subject('s3', 'Ku', 'Kunst', true)];
  const { client, calls } = fakeClient({
    'GET /api/subjects': (call: FakeCall) => ({
      data: { subjects: subjects.filter((s) => call.params?.include_archived === 1 || !s.archived).sort((a, b) => a.code.localeCompare(b.code)) }
    }),
    'POST /api/subjects/s1/update': (call: FakeCall) => {
      const body = call.data as { name: string };
      subjects = subjects.map((s) => (s.id === 's1' ? { ...s, ...body } : s));
      return { data: { subject: subjects.find((s) => s.id === 's1') } };
    },
    'POST /api/subjects/s1/archive': () => {
      subjects = subjects.map((s) => (s.id === 's1' ? { ...s, archived: true } : s));
      return { data: { subject: subjects.find((s) => s.id === 's1') } };
    },
    'POST /api/subjects/s3/restore': () => {
      subjects = subjects.map((s) => (s.id === 's3' ? { ...s, archived: false } : s));
      return { data: { subject: subjects.find((s) => s.id === 's3') } };
    },
    'POST /api/subjects/s2/delete': () => {
      subjects = subjects.filter((s) => s.id !== 's2');
      return { data: { deleted: true, id: 's2' } };
    },
    ...extra
  });
  render(<SubjectsPage apiClient={client} canManage={canManage} />);
  return { calls, writes: () => calls.filter((c) => c.method !== 'GET'), reads: () => calls.filter((c) => c.method === 'GET' && c.url === '/api/subjects') };
}

const codes = () => screen.getAllByRole('rowheader').map((h) => h.textContent?.replace('Archiviert', '').trim());

describe('Faecher: Archivierte anzeigen', () => {
  it('blendet archivierte Faecher standardmaessig aus und fragt sie nicht an', async () => {
    const { reads } = setup();

    await screen.findByRole('rowheader', { name: 'Bi' });
    expect(codes()).toEqual(['Bi', 'Ma']);
    expect(screen.getByRole('checkbox', { name: 'Archivierte anzeigen' })).not.toBeChecked();
    expect(reads()[0].params).toBeUndefined();
  });

  it('blendet sie mit dem Schalter ein, markiert sie und blendet sie wieder aus', async () => {
    const { reads } = setup();
    await screen.findByRole('rowheader', { name: 'Bi' });

    await userEvent.click(screen.getByRole('checkbox', { name: 'Archivierte anzeigen' }));

    expect(await screen.findByRole('rowheader', { name: /Ku/ })).toBeInTheDocument();
    expect(reads().at(-1)?.params).toEqual({ include_archived: 1 });
    const archivedRow = screen.getByRole('rowheader', { name: /Ku/ }).closest('tr')!;
    expect(within(archivedRow).getByText('Archiviert')).toBeInTheDocument();
    expect(screen.getAllByText('Archiviert')).toHaveLength(1);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Archivierte anzeigen' }));

    await waitFor(() => expect(screen.queryByRole('rowheader', { name: /Ku/ })).not.toBeInTheDocument());
    expect(reads().at(-1)?.params).toBeUndefined();
  });

  it('steht auch ohne das Recht Faecher verwalten zur Verfuegung und zeigt dann keine Aktionen', async () => {
    setup({ canManage: false });
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Archivierte anzeigen' }));

    await screen.findByRole('rowheader', { name: /Ku/ });
    expect(screen.queryByRole('button', { name: /Bearbeiten|Archivieren|Wiederherstellen|Löschen/ })).not.toBeInTheDocument();
  });

  it('bietet fuer aktive Faecher Bearbeiten, Archivieren und Loeschen, fuer archivierte Wiederherstellen und Loeschen', async () => {
    setup();
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Archivierte anzeigen' }));
    await screen.findByRole('rowheader', { name: /Ku/ });

    for (const name of ['Bearbeiten: Bi', 'Archivieren: Bi', 'Löschen: Bi', 'Wiederherstellen: Ku', 'Löschen: Ku']) {
      expect(screen.getByRole('button', { name })).toBeEnabled();
    }
    for (const name of ['Bearbeiten: Ku', 'Archivieren: Ku', 'Wiederherstellen: Bi']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });
});

describe('Faecher: Bearbeiten', () => {
  const openEditor = async () => {
    await userEvent.click(await screen.findByRole('button', { name: 'Bearbeiten: Bi' }));
    return screen.getByRole('form', { name: 'Fach bearbeiten' });
  };

  it('oeffnet ein Formular mit der aktuellen Bezeichnung und zeigt das Kuerzel als unveraenderlich', async () => {
    setup();
    const form = await openEditor();

    expect(within(form).getByLabelText('Bezeichnung')).toHaveValue('Biologie');
    expect(within(form).getByText(/Kürzel Bi/)).toBeInTheDocument();
    expect(within(form).queryByLabelText('Kürzel')).not.toBeInTheDocument();
    expect(within(form).getByRole('button', { name: 'Speichern' })).toBeDisabled();
  });

  it('speichert die Bezeichnung ohne Kuerzel, meldet es, laedt neu und schliesst das Formular', async () => {
    const { writes, reads } = setup();
    const form = await openEditor();

    await userEvent.clear(within(form).getByLabelText('Bezeichnung'));
    await userEvent.type(within(form).getByLabelText('Bezeichnung'), '  Bio ');
    await userEvent.click(within(form).getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatchObject({ method: 'POST', url: '/api/subjects/s1/update', data: { name: 'Bio' } });
    expect(Object.keys(writes()[0].data as object)).toEqual(['name']);
    expect(await screen.findByRole('status')).toHaveTextContent('Fach Bi gespeichert.');
    expect(await screen.findByText('Bio')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Fach bearbeiten' })).not.toBeInTheDocument();
    expect(reads()).toHaveLength(2);
  });

  it('warnt vor dem Abschicken bei einer zu langen Bezeichnung', async () => {
    const { writes } = setup();
    const form = await openEditor();

    await userEvent.clear(within(form).getByLabelText('Bezeichnung'));
    await userEvent.type(within(form).getByLabelText('Bezeichnung'), 'x'.repeat(61));

    expect(within(form).getByText(/höchstens 60 Zeichen/)).toBeInTheDocument();
    expect(within(form).getByRole('button', { name: 'Speichern' })).toBeDisabled();
    expect(writes()).toHaveLength(0);
  });

  it('bricht ab, ohne etwas zu schicken', async () => {
    const { writes } = setup();
    const form = await openEditor();

    await userEvent.click(within(form).getByRole('button', { name: 'Abbrechen' }));

    expect(screen.queryByRole('form', { name: 'Fach bearbeiten' })).not.toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  });

  it.each([
    ['subject_archived', 409, /archiviert.*wieder her/i],
    ['subject_not_found', 404, /gibt es nicht mehr/]
  ])('uebersetzt %s, laesst das Formular offen und laedt neu', async (code, status, text) => {
    const { reads } = setup({ extra: { 'POST /api/subjects/s1/update': { status, data: { error: 'x', code } } } });
    const form = await openEditor();

    await userEvent.type(within(form).getByLabelText('Bezeichnung'), 'x');
    await userEvent.click(within(form).getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(screen.getByRole('form', { name: 'Fach bearbeiten' })).toBeInTheDocument();
    await waitFor(() => expect(reads()).toHaveLength(2));
  });

  it('zeigt bei einem unbekannten Fehler den allgemeinen Text', async () => {
    setup({ extra: { 'POST /api/subjects/s1/update': { status: 500 } } });
    const form = await openEditor();

    await userEvent.type(within(form).getByLabelText('Bezeichnung'), 'x');
    await userEvent.click(within(form).getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Das Fach konnte nicht gespeichert werden');
  });
});

describe('Faecher: Archivieren und Wiederherstellen', () => {
  it('archiviert direkt, meldet es und laedt neu (das Fach verschwindet aus der Standardliste)', async () => {
    const { writes } = setup();

    await userEvent.click(await screen.findByRole('button', { name: 'Archivieren: Bi' }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatchObject({ method: 'POST', url: '/api/subjects/s1/archive' });
    expect(await screen.findByRole('status')).toHaveTextContent('Fach Bi archiviert.');
    await waitFor(() => expect(codes()).toEqual(['Ma']));
  });

  it('stellt ein archiviertes Fach wieder her, meldet es und zeigt es wieder als aktives Fach', async () => {
    const { writes } = setup();
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Archivierte anzeigen' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Wiederherstellen: Ku' }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatchObject({ method: 'POST', url: '/api/subjects/s3/restore' });
    expect(await screen.findByRole('status')).toHaveTextContent('Fach Ku wiederhergestellt.');
    await waitFor(() => expect(screen.queryByText('Archiviert')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Archivieren: Ku' })).toBeInTheDocument();
  });

  it('zeigt eine Ablehnung beim Archivieren und laedt neu', async () => {
    const { reads } = setup({ extra: { 'POST /api/subjects/s1/archive': { status: 409, data: { error: 'x', code: 'subject_already_archived' } } } });

    await userEvent.click(await screen.findByRole('button', { name: 'Archivieren: Bi' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('bereits archiviert');
    await waitFor(() => expect(reads()).toHaveLength(2));
  });

  it('zeigt bei einem unbekannten Fehler beim Wiederherstellen den allgemeinen Text', async () => {
    setup({ extra: { 'POST /api/subjects/s3/restore': { status: 500 } } });
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Archivierte anzeigen' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Wiederherstellen: Ku' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Das Fach konnte nicht wiederhergestellt werden');
  });
});

describe('Faecher: Loeschen', () => {
  it('fragt vor dem Loeschen nach und tut bei Abbrechen nichts', async () => {
    const { writes } = setup();

    await userEvent.click(await screen.findByRole('button', { name: 'Löschen: Ma' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Fach Ma');
    expect(dialog).toHaveTextContent('endgültig');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  });

  it('loescht nach der Bestaetigung, meldet es und laedt neu', async () => {
    const { writes } = setup();

    await userEvent.click(await screen.findByRole('button', { name: 'Löschen: Ma' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Löschen' }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatchObject({ method: 'POST', url: '/api/subjects/s2/delete' });
    expect(await screen.findByRole('status')).toHaveTextContent('Fach Ma gelöscht.');
    await waitFor(() => expect(codes()).toEqual(['Bi']));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('weist ein verknuepftes Fach ab und verweist auf das Archivieren', async () => {
    const { reads } = setup({ extra: { 'POST /api/subjects/s2/delete': { status: 409, data: { error: 'x', code: 'subject_linked' } } } });

    await userEvent.click(await screen.findByRole('button', { name: 'Löschen: Ma' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Löschen' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/verknüpft.*archivieren/i);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(reads()).toHaveLength(2));
  });

  it('zeigt bei einem unbekannten Fehler den allgemeinen Text', async () => {
    setup({ extra: { 'POST /api/subjects/s2/delete': { status: 500 } } });

    await userEvent.click(await screen.findByRole('button', { name: 'Löschen: Ma' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Löschen' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Das Fach konnte nicht gelöscht werden');
  });
});

describe('Fehlertexte der Fach-Aktionen', () => {
  const failure = (status: number, code: string) =>
    new AxiosError('x', 'ERR_BAD_REQUEST', undefined, null, { data: { error: 'x', code }, status, statusText: '', headers: {}, config: {} as never });

  it.each([
    ['subject_not_found', 404, 'update', /gibt es nicht mehr/],
    ['subject_archived', 409, 'update', /archiviert.*wieder her/i],
    ['subject_already_archived', 409, 'archive', /bereits archiviert/],
    ['subject_not_archived', 409, 'restore', /nicht archiviert/],
    ['subject_linked', 409, 'delete', /verknüpft.*archivieren/i]
  ] as const)('uebersetzt %s', (code, status, action, text) => {
    expect(describeSubjectFailure(failure(status, code), action)).toMatch(text);
  });
});
