import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import ClassesPanel from './ClassesPanel';
import { fakeClient, type FakeCall } from '../test/fakeHttp';

const YEAR = { id: 'sy-2', name: '2026/27' };
const klass = (id: string, grade_level: number, name: string, archived = false) => ({ id, grade_level, name, archived, school_year: YEAR });

/** Fake-API mit zwei aktiven und einer archivierten Klasse; Aktionen veraendern den Stand wie die echte API. */
function setup({ canManage = true, extra = {} }: { canManage?: boolean; extra?: Record<string, Parameters<typeof fakeClient>[0][string]> } = {}) {
  let classes = [klass('c1', 7, '7a'), klass('c2', 7, '7b'), klass('c3', 6, '6a', true)];
  const { client, calls } = fakeClient({
    'GET /api/classes': (call: FakeCall) => ({
      data: { classes: classes.filter((c) => call.params?.include_archived === 1 || !c.archived).sort((a, b) => a.grade_level - b.grade_level || a.name.localeCompare(b.name)) }
    }),
    'POST /api/classes/c1/update': (call: FakeCall) => {
      const body = call.data as { grade_level: number; name: string };
      classes = classes.map((c) => (c.id === 'c1' ? { ...c, ...body } : c));
      return { data: { class: classes.find((c) => c.id === 'c1') } };
    },
    'POST /api/classes/c1/archive': () => {
      classes = classes.map((c) => (c.id === 'c1' ? { ...c, archived: true } : c));
      return { data: { class: classes.find((c) => c.id === 'c1') } };
    },
    'POST /api/classes/c3/restore': () => {
      classes = classes.map((c) => (c.id === 'c3' ? { ...c, archived: false } : c));
      return { data: { class: classes.find((c) => c.id === 'c3') } };
    },
    'POST /api/classes/c2/delete': () => {
      classes = classes.filter((c) => c.id !== 'c2');
      return { data: { deleted: true, id: 'c2' } };
    },
    ...extra
  });
  render(<ClassesPanel apiClient={client} schoolYear={YEAR} canManage={canManage} />);
  return { calls, writes: () => calls.filter((c) => c.method !== 'GET'), reads: () => calls.filter((c) => c.method === 'GET' && c.url === '/api/classes') };
}

const names = () => screen.getAllByRole('rowheader').map((h) => h.textContent?.replace('Archiviert', '').trim());

describe('Klassen: Archivierte anzeigen', () => {
  it('blendet archivierte Klassen standardmaessig aus und fragt sie nicht an', async () => {
    const { reads } = setup();

    await screen.findByRole('rowheader', { name: '7a' });
    expect(names()).toEqual(['7a', '7b']);
    expect(screen.getByRole('checkbox', { name: 'Archivierte anzeigen' })).not.toBeChecked();
    expect(reads()[0].params).toEqual({ school_year_id: 'sy-2' });
  });

  it('blendet sie mit dem Schalter ein, markiert sie und blendet sie wieder aus', async () => {
    const { reads } = setup();
    await screen.findByRole('rowheader', { name: '7a' });

    await userEvent.click(screen.getByRole('checkbox', { name: 'Archivierte anzeigen' }));

    expect(await screen.findByRole('rowheader', { name: /6a/ })).toBeInTheDocument();
    expect(reads().at(-1)?.params).toEqual({ school_year_id: 'sy-2', include_archived: 1 });
    const archivedRow = screen.getByRole('rowheader', { name: /6a/ }).closest('tr')!;
    expect(within(archivedRow).getByText('Archiviert')).toBeInTheDocument();
    expect(screen.getAllByText('Archiviert')).toHaveLength(1);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Archivierte anzeigen' }));

    await waitFor(() => expect(screen.queryByRole('rowheader', { name: /6a/ })).not.toBeInTheDocument());
    expect(reads().at(-1)?.params).toEqual({ school_year_id: 'sy-2' });
  });

  it('steht auch ohne das Recht Klassen verwalten zur Verfuegung und zeigt dann keine Aktionen', async () => {
    setup({ canManage: false });
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Archivierte anzeigen' }));

    await screen.findByRole('rowheader', { name: /6a/ });
    expect(screen.queryByRole('button', { name: /Bearbeiten|Archivieren|Wiederherstellen|Löschen/ })).not.toBeInTheDocument();
  });

  it('bietet fuer aktive Klassen Bearbeiten, Archivieren und Loeschen, fuer archivierte Wiederherstellen und Loeschen', async () => {
    setup();
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Archivierte anzeigen' }));
    await screen.findByRole('rowheader', { name: /6a/ });

    for (const name of ['Bearbeiten: 7a', 'Archivieren: 7a', 'Löschen: 7a', 'Wiederherstellen: 6a', 'Löschen: 6a']) {
      expect(screen.getByRole('button', { name })).toBeEnabled();
    }
    for (const name of ['Bearbeiten: 6a', 'Archivieren: 6a', 'Wiederherstellen: 7a']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });
});

describe('Klassen: Bearbeiten', () => {
  const openEditor = async () => {
    await userEvent.click(await screen.findByRole('button', { name: 'Bearbeiten: 7a' }));
    return screen.getByRole('form', { name: 'Klasse bearbeiten' });
  };

  it('oeffnet ein Formular mit den aktuellen Werten und zeigt das Schuljahr als unveraenderlich', async () => {
    setup();
    const form = await openEditor();

    expect(within(form).getByLabelText('Klassenstufe')).toHaveValue(7);
    expect(within(form).getByLabelText('Bezeichnung')).toHaveValue('7a');
    expect(within(form).getByText(/Schuljahr 2026\/27/)).toBeInTheDocument();
    expect(within(form).queryByLabelText('Schuljahr')).not.toBeInTheDocument();
    expect(within(form).getByRole('button', { name: 'Speichern' })).toBeDisabled();
  });

  it('speichert Klassenstufe und Bezeichnung, meldet es, laedt neu und schliesst das Formular', async () => {
    const { writes, reads } = setup();
    const form = await openEditor();

    await userEvent.clear(within(form).getByLabelText('Klassenstufe'));
    await userEvent.type(within(form).getByLabelText('Klassenstufe'), '8');
    await userEvent.clear(within(form).getByLabelText('Bezeichnung'));
    await userEvent.type(within(form).getByLabelText('Bezeichnung'), '  8c ');
    await userEvent.click(within(form).getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatchObject({ method: 'POST', url: '/api/classes/c1/update', data: { grade_level: 8, name: '8c' } });
    expect(Object.keys(writes()[0].data as object).sort()).toEqual(['grade_level', 'name']);
    expect(await screen.findByRole('status')).toHaveTextContent('Klasse 8c gespeichert.');
    expect(await screen.findByRole('rowheader', { name: '8c' })).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Klasse bearbeiten' })).not.toBeInTheDocument();
    expect(reads()).toHaveLength(2);
  });

  it('warnt vor dem Abschicken bei ungueltigen Eingaben', async () => {
    const { writes } = setup();
    const form = await openEditor();

    await userEvent.clear(within(form).getByLabelText('Klassenstufe'));
    await userEvent.type(within(form).getByLabelText('Klassenstufe'), '14');

    expect(within(form).getByText(/ganze Zahl von 1 bis 13/)).toBeInTheDocument();
    expect(within(form).getByRole('button', { name: 'Speichern' })).toBeDisabled();
    expect(writes()).toHaveLength(0);
  });

  it('bricht ab, ohne etwas zu schicken', async () => {
    const { writes } = setup();
    const form = await openEditor();

    await userEvent.click(within(form).getByRole('button', { name: 'Abbrechen' }));

    expect(screen.queryByRole('form', { name: 'Klasse bearbeiten' })).not.toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  });

  it.each([
    ['class_name_taken', 409, /bereits eine Klasse mit dieser Bezeichnung/],
    ['class_archived', 409, /archiviert.*wieder her/i],
    ['class_not_found', 404, /gibt es nicht mehr/]
  ])('uebersetzt %s, laesst das Formular offen und laedt neu', async (code, status, text) => {
    const { reads } = setup({ extra: { 'POST /api/classes/c1/update': { status, data: { error: 'x', code } } } });
    const form = await openEditor();

    await userEvent.type(within(form).getByLabelText('Bezeichnung'), 'x');
    await userEvent.click(within(form).getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(screen.getByRole('form', { name: 'Klasse bearbeiten' })).toBeInTheDocument();
    await waitFor(() => expect(reads()).toHaveLength(2));
  });

  it('zeigt bei einem unbekannten Fehler den allgemeinen Text', async () => {
    setup({ extra: { 'POST /api/classes/c1/update': { status: 500 } } });
    const form = await openEditor();

    await userEvent.type(within(form).getByLabelText('Bezeichnung'), 'x');
    await userEvent.click(within(form).getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Die Klasse konnte nicht gespeichert werden');
  });
});

describe('Klassen: Archivieren und Wiederherstellen', () => {
  it('archiviert direkt, meldet es und laedt neu (die Klasse verschwindet aus der Standardliste)', async () => {
    const { writes } = setup();

    await userEvent.click(await screen.findByRole('button', { name: 'Archivieren: 7a' }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatchObject({ method: 'POST', url: '/api/classes/c1/archive' });
    expect(await screen.findByRole('status')).toHaveTextContent('Klasse 7a archiviert.');
    await waitFor(() => expect(names()).toEqual(['7b']));
  });

  it('stellt eine archivierte Klasse wieder her, meldet es und zeigt sie wieder als aktive Klasse', async () => {
    const { writes } = setup();
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Archivierte anzeigen' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Wiederherstellen: 6a' }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatchObject({ method: 'POST', url: '/api/classes/c3/restore' });
    expect(await screen.findByRole('status')).toHaveTextContent('Klasse 6a wiederhergestellt.');
    await waitFor(() => expect(screen.queryByText('Archiviert')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Archivieren: 6a' })).toBeInTheDocument();
  });

  it('zeigt eine Ablehnung beim Archivieren und laedt neu', async () => {
    const { reads } = setup({ extra: { 'POST /api/classes/c1/archive': { status: 409, data: { error: 'x', code: 'class_already_archived' } } } });

    await userEvent.click(await screen.findByRole('button', { name: 'Archivieren: 7a' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('bereits archiviert');
    await waitFor(() => expect(reads()).toHaveLength(2));
  });

  it('zeigt bei einem unbekannten Fehler beim Wiederherstellen den allgemeinen Text', async () => {
    setup({ extra: { 'POST /api/classes/c3/restore': { status: 500 } } });
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Archivierte anzeigen' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Wiederherstellen: 6a' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Die Klasse konnte nicht wiederhergestellt werden');
  });
});

describe('Klassen: Loeschen', () => {
  it('fragt vor dem Loeschen nach und tut bei Abbrechen nichts', async () => {
    const { writes } = setup();

    await userEvent.click(await screen.findByRole('button', { name: 'Löschen: 7b' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Klasse 7b');
    expect(dialog).toHaveTextContent('endgültig');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  });

  it('loescht nach der Bestaetigung, meldet es und laedt neu', async () => {
    const { writes } = setup();

    await userEvent.click(await screen.findByRole('button', { name: 'Löschen: 7b' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Löschen' }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatchObject({ method: 'POST', url: '/api/classes/c2/delete' });
    expect(await screen.findByRole('status')).toHaveTextContent('Klasse 7b gelöscht.');
    await waitFor(() => expect(names()).toEqual(['7a']));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('weist eine verknuepfte Klasse ab und verweist auf das Archivieren', async () => {
    const { reads } = setup({ extra: { 'POST /api/classes/c2/delete': { status: 409, data: { error: 'x', code: 'class_linked' } } } });

    await userEvent.click(await screen.findByRole('button', { name: 'Löschen: 7b' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Löschen' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/verknüpft.*archivieren/i);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(reads()).toHaveLength(2));
  });

  it('zeigt bei einem unbekannten Fehler den allgemeinen Text', async () => {
    setup({ extra: { 'POST /api/classes/c2/delete': { status: 500 } } });

    await userEvent.click(await screen.findByRole('button', { name: 'Löschen: 7b' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Löschen' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Die Klasse konnte nicht gelöscht werden');
  });
});
