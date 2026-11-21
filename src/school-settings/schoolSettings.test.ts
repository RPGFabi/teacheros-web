import { AxiosError } from 'axios';
import { describe, expect, it } from 'vitest';
import { describeSchoolSettingsFailure, settingProblem, type SchoolSetting } from './schoolSettings';

const failure = (status: number, code?: string) =>
  new AxiosError('x', 'ERR_BAD_REQUEST', undefined, null, { data: code ? { error: 'x', code } : {}, status, statusText: '', headers: {}, config: {} as never });

const teachers: SchoolSetting = { key: 'max_teachers_per_subject_group', value: 2, default: 2, min: 1, max: 50 };

describe('Pruefung einer Eingabe', () => {
  it.each(['1', '2', '50', ' 7 '])('akzeptiert "%s"', (typed) => {
    expect(settingProblem(teachers, typed)).toBeUndefined();
  });

  it.each(['', '0', '51', '-1', '2.5', 'abc', '1e1'])('lehnt "%s" ab und nennt den Bereich', (typed) => {
    expect(settingProblem(teachers, typed)).toBe('Bitte eine ganze Zahl von 1 bis 50 angeben.');
  });
});

describe('Fehlertexte beim Speichern', () => {
  it.each([
    ['forbidden', /Schuleinstellungen verwalten/],
    ['invalid_request', /ganze Zahlen/],
    ['school_settings_busy', /gerade geändert/]
  ])('uebersetzt %s', (code, text) => {
    expect(describeSchoolSettingsFailure(failure(400, code))).toMatch(text);
  });

  it('faellt bei unbekanntem Code oder ohne Antwort auf einen allgemeinen Text zurueck', () => {
    expect(describeSchoolSettingsFailure(failure(500))).toMatch(/konnten nicht gespeichert werden/);
    expect(describeSchoolSettingsFailure(new Error('offline'))).toMatch(/konnten nicht gespeichert werden/);
  });
});
