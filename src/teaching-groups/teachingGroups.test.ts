import { AxiosError } from 'axios';
import { describe, expect, it } from 'vitest';
import { describeTeachingGroupFailure, teachingGroupFormProblem } from './teachingGroups';

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
