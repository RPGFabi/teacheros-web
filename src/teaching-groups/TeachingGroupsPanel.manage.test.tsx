import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import TeachingGroupsPanel from './TeachingGroupsPanel';
import { fakeClient, type FakeCall } from '../test/fakeHttp';

const YEAR = { id: 'sy-2', name: '2026/27' };
const MA = { id: 'su-ma', code: 'Ma', name: 'Mathematik', archived: false };
const EN = { id: 'su-en', code: 'En', name: 'Englisch', archived: false };
const klass = (id: string, grade_level: number, name: string, archived = false) => ({ id, grade_level, name, archived, school_year: YEAR });
const C6A = klass('c0', 6, '6a', true);
const C7A = klass('c1', 7, '7a');
const C7B = klass('c2', 7, '7b');
const C8A = klass('c3', 8, '8a');
type Group = { id: string; name: string; archived: boolean; school_year: typeof YEAR; subject: typeof MA; classes: ReturnType<typeof klass>[] };
const group = (id: string, name: string, subject = MA, classes = [C7A], archived = false): Group => ({ id, name, archived, school_year: YEAR, subject, classes });

/** Fake-API mit zwei aktiven und einer archivierten Fachgruppe; Aktionen veraendern den Stand wie die echte API. */
function setup({ canManage = true, extra = {} }: { canManage?: boolean; extra?: Record<string, Parameters<typeof fakeClient>[0][string]> } = {}) {
  let groups: Group[] = [group('g1', 'Ma 7', MA, [C6A, C7A]), group('g2', 'En 7', EN, [C7B]), group('g3', 'Alt 1', MA, [C7A], true)];
  const set = (id: string, change: Partial<Group>) => {
    groups = groups.map((g) => (g.id === id ? { ...g, ...change } : g));
    return { data: { teaching_group: groups.find((g) => g.id === id) } };
  };
  const { client, calls } = fakeClient({
    'GET /api/teaching-groups': (call: FakeCall) => ({ data: { teaching_groups: groups.filter((g) => call.params?.include_archived === 1 || !g.archived) } }),
    'GET /api/teaching-groups/choices': () => ({ data: { subjects: [EN, MA], classes: [C7A, C7B, C8A] } }),
    'POST /api/teaching-groups/g1/update': (call: FakeCall) => {
      const body = call.data as { name: string; class_ids: string[] };
      return set('g1', { name: body.name, classes: [C6A, C7A, C7B, C8A].filter((c) => body.class_ids.includes(c.id)) });
    },
    'POST /api/teaching-groups/g1/archive': () => set('g1', { archived: true }),
    'POST /api/teaching-groups/g3/restore': () => set('g3', { archived: false }),
    'POST /api/teaching-groups/g2/delete': () => {
      groups = groups.filter((g) => g.id !== 'g2');
      return { data: { deleted: true, id: 'g2' } };
    },
    ...extra
  });
  render(<TeachingGroupsPanel apiClient={client} schoolYear={YEAR} canManage={canManage} onOpen={() => undefined} />);
  return { calls, writes: () => calls.filter((c) => c.method !== 'GET'), reads: () => calls.filter((c) => c.method === 'GET' && c.url === '/api/teaching-groups') };
}

const names = () => screen.getAllByRole('rowheader').map((h) => h.textContent?.replace('Archiviert', '').trim());

describe('Fachgruppen: Archivierte anzeigen', () => {
  it('blendet archivierte Fachgruppen standardmaessig aus und fragt sie nicht an', async () => {
    const { reads } = setup();

    await screen.findByRole('rowheader', { name: 'Ma 7' });
    expect(names()).toEqual(['Ma 7', 'En 7']);
    expect(screen.getByRole('checkbox', { name: 'Archivierte anzeigen' })).not.toBeChecked();
    expect(reads()[0].params).toEqual({ school_year_id: 'sy-2' });
  });

  it('blendet sie mit dem Schalter ein, markiert sie und blendet sie wieder aus', async () => {
    const { reads } = setup();
    await screen.findByRole('rowheader', { name: 'Ma 7' });

    await userEvent.click(screen.getByRole('checkbox', { name: 'Archivierte anzeigen' }));

    const archivedRow = (await screen.findByRole('rowheader', { name: /Alt 1/ })).closest('tr')!;
    expect(reads().at(-1)?.params).toEqual({ school_year_id: 'sy-2', include_archived: 1 });
    expect(within(archivedRow).getByText('Archiviert')).toBeInTheDocument();
    expect(screen.getAllByText('Archiviert')).toHaveLength(1);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Archivierte anzeigen' }));

    await waitFor(() => expect(screen.queryByRole('rowheader', { name: /Alt 1/ })).not.toBeInTheDocument());
    expect(reads().at(-1)?.params).toEqual({ school_year_id: 'sy-2' });
  });

  it('steht auch ohne das Recht Fachgruppen verwalten zur Verfuegung und zeigt dann nur die Details', async () => {
    setup({ canManage: false });
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Archivierte anzeigen' }));

    await screen.findByRole('rowheader', { name: /Alt 1/ });
    expect(screen.queryByRole('button', { name: /Bearbeiten|Archivieren|Wiederherstellen|Löschen/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Details: Alt 1' })).toBeInTheDocument();
  });

  it('bietet fuer aktive Fachgruppen Bearbeiten, Archivieren und Loeschen, fuer archivierte Wiederherstellen und Loeschen', async () => {
    setup();
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Archivierte anzeigen' }));
    await screen.findByRole('rowheader', { name: /Alt 1/ });

    for (const name of ['Bearbeiten: Ma 7', 'Archivieren: Ma 7', 'Löschen: Ma 7', 'Wiederherstellen: Alt 1', 'Löschen: Alt 1']) {
      expect(screen.getByRole('button', { name })).toBeEnabled();
    }
    for (const name of ['Bearbeiten: Alt 1', 'Archivieren: Alt 1', 'Wiederherstellen: Ma 7']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });
});

describe('Fachgruppen: Bearbeiten', () => {
  const openEditor = async () => {
    await userEvent.click(await screen.findByRole('button', { name: 'Bearbeiten: Ma 7' }));
    const form = screen.getByRole('form', { name: 'Fachgruppe bearbeiten' });
    await within(form).findByLabelText('7b');
    return within(form);
  };

  it('oeffnet ein Formular mit den aktuellen Werten, zeigt Schuljahr und Fach als unveraenderlich und die Klassen als Ankreuzfelder', async () => {
    const { calls } = setup();
    const form = await openEditor();

    expect(form.getByLabelText('Bezeichnung')).toHaveValue('Ma 7');
    expect(form.getByText(/Schuljahr 2026\/27/)).toBeInTheDocument();
    expect(form.getByText(/Ma – Mathematik/)).toBeInTheDocument();
    expect(form.queryByLabelText('Fach')).not.toBeInTheDocument();
    expect(form.queryByLabelText('Schuljahr')).not.toBeInTheDocument();
    // eigene (auch archivierte) Klassen plus die waehlbaren, nach Klassenstufe und Bezeichnung
    expect(form.getAllByRole('checkbox').map((c) => c.closest('label')?.textContent)).toEqual(['6a (archiviert)', '7a', '7b', '8a']);
    expect(form.getAllByRole('checkbox').map((c) => (c as HTMLInputElement).checked)).toEqual([true, true, false, false]);
    expect(form.getByRole('button', { name: 'Speichern' })).toBeDisabled();
    expect(calls.filter((c) => c.url === '/api/teaching-groups/choices').at(-1)?.params).toEqual({ school_year_id: 'sy-2' });
  });

  it('speichert Bezeichnung und Klassen (Menge der Kennungen, nach Klassenstufe), meldet es, laedt neu und schliesst das Formular', async () => {
    const { writes, reads } = setup();
    const form = await openEditor();

    await userEvent.clear(form.getByLabelText('Bezeichnung'));
    await userEvent.type(form.getByLabelText('Bezeichnung'), '  Ma 7/8 ');
    await userEvent.click(form.getByLabelText('8a'));
    await userEvent.click(form.getByLabelText('7b'));
    await userEvent.click(form.getByLabelText('6a (archiviert)'));
    await userEvent.click(form.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatchObject({ method: 'POST', url: '/api/teaching-groups/g1/update', data: { name: 'Ma 7/8', class_ids: ['c1', 'c2', 'c3'] } });
    expect(Object.keys(writes()[0].data as object).sort()).toEqual(['class_ids', 'name']);
    expect(await screen.findByRole('status')).toHaveTextContent('Fachgruppe Ma 7/8 gespeichert.');
    expect(await screen.findByRole('rowheader', { name: 'Ma 7/8' })).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Fachgruppe bearbeiten' })).not.toBeInTheDocument();
    expect(reads()).toHaveLength(2);
  });

  it('erlaubt, nur die Klassen zu aendern, und behaelt eine archivierte Klasse, solange sie angekreuzt bleibt', async () => {
    const { writes } = setup();
    const form = await openEditor();

    await userEvent.click(form.getByLabelText('7b'));
    await userEvent.click(form.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0].data).toEqual({ name: 'Ma 7', class_ids: ['c0', 'c1', 'c2'] });
  });

  it.each([
    ['Bezeichnung leeren', async (f: ReturnType<typeof within>) => userEvent.clear(f.getByLabelText('Bezeichnung')), /Bezeichnung an/],
    [
      'alle Klassen abwaehlen',
      async (f: ReturnType<typeof within>) => {
        await userEvent.click(f.getByLabelText('6a (archiviert)'));
        await userEvent.click(f.getByLabelText('7a'));
      },
      /mindestens eine Klasse/
    ]
  ])('warnt vor dem Abschicken bei: %s', async (_label, change, hint) => {
    const { writes } = setup();
    const form = await openEditor();

    await change(form);

    expect(form.getByRole('alert')).toHaveTextContent(hint);
    expect(form.getByRole('button', { name: 'Speichern' })).toBeDisabled();
    expect(writes()).toHaveLength(0);
  });

  it('bricht ab, ohne etwas zu schicken', async () => {
    const { writes } = setup();
    const form = await openEditor();

    await userEvent.click(form.getByRole('button', { name: 'Abbrechen' }));

    expect(screen.queryByRole('form', { name: 'Fachgruppe bearbeiten' })).not.toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  });

  it.each([
    ['teaching_group_name_taken', 409, /bereits eine Fachgruppe mit dieser Bezeichnung/],
    ['teaching_group_archived', 409, /archiviert.*wieder her/i],
    ['teaching_group_not_found', 404, /gibt es nicht mehr/],
    ['class_not_selectable', 409, /Klasse .* archiviert/]
  ])('uebersetzt %s, laesst das Formular offen und laedt neu', async (code, status, text) => {
    const { reads } = setup({ extra: { 'POST /api/teaching-groups/g1/update': { status, data: { error: 'x', code } } } });
    const form = await openEditor();

    await userEvent.type(form.getByLabelText('Bezeichnung'), 'x');
    await userEvent.click(form.getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(screen.getByRole('form', { name: 'Fachgruppe bearbeiten' })).toBeInTheDocument();
    await waitFor(() => expect(reads()).toHaveLength(2));
  });

  it('zeigt den Einwand eines anderen Moduls gegen das Entfernen einer Klasse mit seiner Meldung', async () => {
    setup({ extra: { 'POST /api/teaching-groups/g1/update': { status: 409, data: { error: 'Aus der Klasse 7a sind noch Mitglieder in der Fachgruppe.', code: 'teaching_group_class_has_members' } } } });
    const form = await openEditor();

    await userEvent.click(form.getByLabelText('7a'));
    await userEvent.click(form.getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Aus der Klasse 7a sind noch Mitglieder in der Fachgruppe.');
  });

  it('zeigt bei einem unbekannten Fehler den allgemeinen Text', async () => {
    setup({ extra: { 'POST /api/teaching-groups/g1/update': { status: 500 } } });
    const form = await openEditor();

    await userEvent.type(form.getByLabelText('Bezeichnung'), 'x');
    await userEvent.click(form.getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Die Fachgruppe konnte nicht gespeichert werden');
  });

  it('zeigt bei einem Fehler beim Laden der Auswahl eine Meldung und laedt auf Wunsch erneut', async () => {
    let attempts = 0; // der erste Abruf gehoert dem Anlegen-Formular, der zweite dem Bearbeiten-Formular
    setup({ extra: { 'GET /api/teaching-groups/choices': () => (++attempts === 2 ? { status: 500 } : { data: { subjects: [MA], classes: [C7A, C7B] } }) } });
    await userEvent.click(await screen.findByRole('button', { name: 'Bearbeiten: Ma 7' }));
    const form = within(screen.getByRole('form', { name: 'Fachgruppe bearbeiten' }));

    expect(await form.findByText('Die Auswahl der Klassen konnte nicht geladen werden.')).toBeInTheDocument();
    expect(form.getByRole('button', { name: 'Speichern' })).toBeDisabled();
    await userEvent.click(form.getByRole('button', { name: 'Erneut laden' }));

    expect(await form.findByLabelText('7b')).toBeInTheDocument();
  });
});

describe('Fachgruppen: Archivieren und Wiederherstellen', () => {
  it('archiviert direkt, meldet es und laedt neu (die Fachgruppe verschwindet aus der Standardliste)', async () => {
    const { writes } = setup();

    await userEvent.click(await screen.findByRole('button', { name: 'Archivieren: Ma 7' }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatchObject({ method: 'POST', url: '/api/teaching-groups/g1/archive' });
    expect(await screen.findByRole('status')).toHaveTextContent('Fachgruppe Ma 7 archiviert.');
    await waitFor(() => expect(names()).toEqual(['En 7']));
  });

  it('stellt eine archivierte Fachgruppe wieder her, meldet es und zeigt sie wieder als aktive', async () => {
    const { writes } = setup();
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Archivierte anzeigen' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Wiederherstellen: Alt 1' }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatchObject({ method: 'POST', url: '/api/teaching-groups/g3/restore' });
    expect(await screen.findByRole('status')).toHaveTextContent('Fachgruppe Alt 1 wiederhergestellt.');
    await waitFor(() => expect(screen.queryByText('Archiviert')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Archivieren: Alt 1' })).toBeInTheDocument();
  });

  it('zeigt eine Ablehnung beim Archivieren und laedt neu', async () => {
    const { reads } = setup({ extra: { 'POST /api/teaching-groups/g1/archive': { status: 409, data: { error: 'x', code: 'teaching_group_already_archived' } } } });

    await userEvent.click(await screen.findByRole('button', { name: 'Archivieren: Ma 7' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('bereits archiviert');
    await waitFor(() => expect(reads()).toHaveLength(2));
  });

  it('zeigt bei einem unbekannten Fehler beim Wiederherstellen den allgemeinen Text', async () => {
    setup({ extra: { 'POST /api/teaching-groups/g3/restore': { status: 500 } } });
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Archivierte anzeigen' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Wiederherstellen: Alt 1' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Die Fachgruppe konnte nicht wiederhergestellt werden');
  });
});

describe('Fachgruppen: Loeschen', () => {
  it('fragt vor dem Loeschen nach und tut bei Abbrechen nichts', async () => {
    const { writes } = setup();

    await userEvent.click(await screen.findByRole('button', { name: 'Löschen: En 7' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Fachgruppe En 7');
    expect(dialog).toHaveTextContent('endgültig');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  });

  it('loescht nach der Bestaetigung, meldet es und laedt neu', async () => {
    const { writes } = setup();

    await userEvent.click(await screen.findByRole('button', { name: 'Löschen: En 7' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Löschen' }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatchObject({ method: 'POST', url: '/api/teaching-groups/g2/delete' });
    expect(await screen.findByRole('status')).toHaveTextContent('Fachgruppe En 7 gelöscht.');
    await waitFor(() => expect(names()).toEqual(['Ma 7']));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('weist eine verknuepfte Fachgruppe ab und verweist auf das Archivieren', async () => {
    const { reads } = setup({ extra: { 'POST /api/teaching-groups/g2/delete': { status: 409, data: { error: 'x', code: 'teaching_group_linked' } } } });

    await userEvent.click(await screen.findByRole('button', { name: 'Löschen: En 7' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Löschen' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/verknüpft.*archivieren/i);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(reads()).toHaveLength(2));
  });

  it('zeigt bei einem unbekannten Fehler den allgemeinen Text', async () => {
    setup({ extra: { 'POST /api/teaching-groups/g2/delete': { status: 500 } } });

    await userEvent.click(await screen.findByRole('button', { name: 'Löschen: En 7' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Löschen' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Die Fachgruppe konnte nicht gelöscht werden');
  });
});
