import { AxiosError } from 'axios';
import { describe, expect, it } from 'vitest';
import { describeSubjectFailure, subjectFormProblem } from './subjects';

const failure = (status: number, code?: string) =>
  new AxiosError('x', 'ERR_BAD_REQUEST', undefined, null, { data: code ? { error: 'x', code } : {}, status, statusText: '', headers: {}, config: {} as never });

describe('Pruefung des Formulars', () => {
  it.each([
    ['Ev', 'Evangelische Religion'],
    ['a', 'a'],
    ['1234567890', 'x'.repeat(60)],
    ['Ge-Wi_2', 'Geschichte'],
    ['Kü', 'Kunst'],
    ['  Ph  ', '  Physik  ']
  ])('akzeptiert Kuerzel "%s" und Bezeichnung "%s"', (code, name) => {
    expect(subjectFormProblem(code, name)).toBeUndefined();
  });

  it.each([['', 'Deutsch'], ['   ', 'Deutsch'], ['12345678901', 'Deutsch'], ['D E', 'Deutsch'], ['D.', 'Deutsch'], ['D/E', 'Deutsch']])(
    'lehnt das Kuerzel "%s" ab',
    (code, name) => {
      expect(subjectFormProblem(code, name)).toMatch(/Kürzel/);
    }
  );

  it('zaehlt das Kuerzel nach dem Trimmen und in Zeichen, nicht in Bytes', () => {
    expect(subjectFormProblem(' ' + 'ä'.repeat(10) + ' ', 'Deutsch')).toBeUndefined();
    expect(subjectFormProblem('ä'.repeat(11), 'Deutsch')).toMatch(/Kürzel/);
  });

  it('lehnt eine leere oder zu lange Bezeichnung ab, gezaehlt nach dem Trimmen', () => {
    expect(subjectFormProblem('D', '   ')).toMatch(/Bezeichnung/);
    expect(subjectFormProblem('D', 'x'.repeat(61))).toMatch(/höchstens 60 Zeichen/);
  });
});

describe('Fehlertexte beim Anlegen', () => {
  it.each([
    ['subject_code_taken', /bereits ein Fach mit diesem Kürzel/],
    ['invalid_request', /Kürzel.*Bezeichnung/s],
    ['forbidden', /Fächer verwalten/]
  ])('uebersetzt %s', (code, text) => {
    expect(describeSubjectFailure(failure(code === 'subject_code_taken' ? 409 : code === 'forbidden' ? 403 : 400, code))).toMatch(text);
  });

  it('nennt bei einem unbekannten Fehler den allgemeinen Text', () => {
    expect(describeSubjectFailure(failure(500))).toMatch(/Das Fach konnte nicht angelegt werden/);
  });
});
