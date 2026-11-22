import { AxiosError } from 'axios';
import { describe, expect, it } from 'vitest';
import { describeTeachingGroupFailure, editableClasses, teachingGroupFormProblem } from './teachingGroups';

const failure = (status: number, code?: string) =>
  new AxiosError('x', 'ERR_BAD_REQUEST', undefined, null, { data: code ? { error: 'x', code } : {}, status, statusText: '', headers: {}, config: {} as never });

describe('Pruefung des Formulars', () => {
  it.each([['Ma 7'], ['a'], ['x'.repeat(40)], ['ä'.repeat(40)], ['  AES 1  ']])('akzeptiert die Bezeichnung "%s" mit Fach und Klasse', (name) => {
    expect(teachingGroupFormProblem(name, 'su-1', ['c1'])).toBeUndefined();
  });

  it('lehnt eine leere oder zu lange Bezeichnung ab, gezaehlt nach dem Trimmen und in Zeichen', () => {
    expect(teachingGroupFormProblem('   ', 'su-1', ['c1'])).toMatch(/Bezeichnung an/);
    expect(teachingGroupFormProblem('x'.repeat(41), 'su-1', ['c1'])).toMatch(/höchstens 40 Zeichen/);
    expect(teachingGroupFormProblem('ä'.repeat(41), 'su-1', ['c1'])).toMatch(/höchstens 40 Zeichen/);
  });

  it('verlangt ein Fach und mindestens eine Klasse', () => {
    expect(teachingGroupFormProblem('Ma 7', '', ['c1'])).toMatch(/Fach/);
    expect(teachingGroupFormProblem('Ma 7', 'su-1', [])).toMatch(/mindestens eine Klasse/);
  });
});

describe('Fehlertexte beim Anlegen', () => {
  it.each([
    ['teaching_group_name_taken', /bereits eine Fachgruppe mit dieser Bezeichnung/],
    ['subject_not_selectable', /Fach .* nicht wählbar/],
    ['class_not_selectable', /Klasse .* archiviert/],
    ['school_year_not_found', /Schuljahr gibt es nicht mehr/],
    ['invalid_request', /Bezeichnung mit 1 bis 40 Zeichen/],
    ['forbidden', /„Fachgruppen verwalten“/]
  ])('uebersetzt den Code %s', (code, text) => {
    expect(describeTeachingGroupFailure(failure(409, code))).toMatch(text);
  });

  it('faellt ohne bekannten Code auf einen allgemeinen Text zurueck', () => {
    expect(describeTeachingGroupFailure(failure(500))).toMatch(/konnte nicht angelegt werden/);
  });
});

describe('Fehlertexte beim Verwalten', () => {
  it.each([
    ['teaching_group_not_found', 404, /Fachgruppe gibt es nicht mehr/],
    ['teaching_group_archived', 409, /archiviert.*wieder her/i],
    ['teaching_group_already_archived', 409, /bereits archiviert/],
    ['teaching_group_not_archived', 409, /nicht archiviert/],
    ['teaching_group_linked', 409, /verknüpft.*archivieren/i]
  ])('uebersetzt den Code %s', (code, status, text) => {
    expect(describeTeachingGroupFailure(failure(status, code), 'delete')).toMatch(text);
  });

  it('zeigt bei einem unbekannten Code mit Status 409 die Meldung der API (Einwand eines anderen Moduls)', () => {
    const err = new AxiosError('x', 'ERR_BAD_REQUEST', undefined, null, { data: { error: 'Es gibt noch Mitglieder.', code: 'members_in_class' }, status: 409, statusText: '', headers: {}, config: {} as never });

    expect(describeTeachingGroupFailure(err, 'update')).toBe('Es gibt noch Mitglieder.');
  });

  it.each([
    ['update', /nicht gespeichert werden/],
    ['archive', /nicht archiviert werden/],
    ['restore', /nicht wiederhergestellt werden/],
    ['delete', /nicht gelöscht werden/]
  ] as const)('faellt bei %s ohne bekannten Code auf einen allgemeinen Text zurueck', (action, text) => {
    expect(describeTeachingGroupFailure(failure(500), action)).toMatch(text);
  });
});

describe('Klassen im Bearbeiten-Formular', () => {
  const klass = (id: string, grade_level: number, name: string, archived = false) => ({ id, grade_level, name, archived, school_year: { id: 'sy', name: '2026/27' } });

  it('vereint die eigenen und die waehlbaren Klassen ohne Doppelte, nach Klassenstufe und natuerlicher Bezeichnung', () => {
    const own = [klass('c1', 7, '7a'), klass('c0', 6, '6a', true)];
    const selectable = [klass('c1', 7, '7a'), klass('c10', 10, '10a'), klass('c2', 7, '7b'), klass('c3', 8, '8a')];

    expect(editableClasses(own, selectable).map((c) => c.name)).toEqual(['6a', '7a', '7b', '8a', '10a']);
  });
});
