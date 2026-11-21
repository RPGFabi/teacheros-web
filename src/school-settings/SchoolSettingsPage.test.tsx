import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import SchoolSettingsPage from './SchoolSettingsPage';
import { fakeClient, type FakeCall } from '../test/fakeHttp';

const TEACHERS = { key: 'max_teachers_per_teaching_group', value: 2, default: 2, min: 1, max: 50 };
const LEADERS = { key: 'max_class_leaders_per_class', value: 2, default: 2, min: 1, max: 10 };

const setup = (extra: Record<string, Parameters<typeof fakeClient>[0][string]> = {}) => {
  let settings = [TEACHERS, LEADERS];
  const { client, calls } = fakeClient({
    'GET /api/school-settings': () => ({ data: { school_settings: settings } }),
    'POST /api/school-settings/update': (call: FakeCall) => {
      const body = call.data as Record<string, number>;
      settings = settings.map((s) => (s.key in body ? { ...s, value: body[s.key] } : s));
      return { data: { school_settings: settings } };
    },
    ...extra
  });
  render(<SchoolSettingsPage apiClient={client} />);
  return { calls, writes: () => calls.filter((c) => c.method !== 'GET') };
};

const teachersField = () => screen.findByLabelText('Lehrkräfte je Fachgruppe');
const leadersField = () => screen.findByLabelText('Klassenleitungen je Klasse');

describe('Schuleinstellungen: Anzeige', () => {
  it('zeigt waehrend des Ladens einen Hinweis und danach beide Werte', async () => {
    setup();

    expect(screen.getByRole('heading', { level: 1, name: 'Schuleinstellungen' })).toBeInTheDocument();
    expect(screen.getByText('Schuleinstellungen werden geladen …')).toBeInTheDocument();
    expect(await teachersField()).toHaveValue(2);
    expect(await leadersField()).toHaveValue(2);
  });

  it('nennt je Einstellung Standard und zulaessigen Bereich aus der API', async () => {
    setup();

    await teachersField();
    expect(screen.getByText(/Standard 2, erlaubt 1 bis 50/)).toBeInTheDocument();
    expect(screen.getByText(/Standard 2, erlaubt 1 bis 10/)).toBeInTheDocument();
  });

  it('erklaert, dass ein verschaerfter Wert nur fuer Neues gilt und fuer alle Schuljahre', async () => {
    setup();

    await teachersField();
    expect(screen.getByText(/gelten für die ganze Schule und alle Schuljahre/)).toBeInTheDocument();
    expect(screen.getByText(/Bestehende Zuordnungen bleiben unberührt/)).toBeInTheDocument();
  });

  it('zeigt bei einem Ladefehler eine Meldung und laedt auf Wunsch erneut', async () => {
    let attempts = 0;
    setup({ 'GET /api/school-settings': () => (++attempts === 1 ? { status: 500 } : { data: { school_settings: [TEACHERS, LEADERS] } }) });

    expect(await screen.findByRole('alert')).toHaveTextContent('Die Schuleinstellungen konnten nicht geladen werden');
    await userEvent.click(screen.getByRole('button', { name: 'Erneut laden' }));

    expect(await teachersField()).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Schuleinstellungen: Aendern', () => {
  it('speichert nur den geaenderten Wert und meldet den Erfolg', async () => {
    const { writes } = setup();

    const field = await teachersField();
    await userEvent.clear(field);
    await userEvent.type(field, '5');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Schuleinstellungen gespeichert.');
    expect(writes()).toHaveLength(1);
    expect(writes()[0]).toMatchObject({ method: 'POST', url: '/api/school-settings/update', data: { max_teachers_per_teaching_group: 5 } });
    expect(await teachersField()).toHaveValue(5);
  });

  it('schickt beide Werte, wenn beide geaendert wurden', async () => {
    const { writes } = setup();

    const teachers = await teachersField();
    await userEvent.clear(teachers);
    await userEvent.type(teachers, '3');
    const leaders = await leadersField();
    await userEvent.clear(leaders);
    await userEvent.type(leaders, '1');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await screen.findByRole('status');
    expect(writes()[0].data).toEqual({ max_teachers_per_teaching_group: 3, max_class_leaders_per_class: 1 });
  });

  it('sperrt Speichern, solange nichts geaendert ist', async () => {
    setup();

    await teachersField();
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled();
  });

  it.each([['0'], ['51'], ['2.5'], ['']])('weist den Wert "%s" vor dem Senden mit einem Hinweis ab', async (typed) => {
    const { writes } = setup();

    const field = await teachersField();
    await userEvent.clear(field);
    if (typed !== '') await userEvent.type(field, typed);

    expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/ganze Zahl von 1 bis 50/);
    expect(writes()).toEqual([]);
  });

  it('uebersetzt eine Ablehnung der API und laesst die Eingabe stehen', async () => {
    setup({ 'POST /api/school-settings/update': { status: 403, data: { error: 'Forbidden', code: 'forbidden' } } });

    const field = await teachersField();
    await userEvent.clear(field);
    await userEvent.type(field, '4');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Schuleinstellungen verwalten');
    expect(await teachersField()).toHaveValue(4);
  });
});
