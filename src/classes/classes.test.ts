import { AxiosError } from 'axios';
import { describe, expect, it } from 'vitest';
import { classFormProblem, defaultSchoolYear, describeClassFailure } from './classes';

const year = (id: string, status: string) => ({ id, name: id, starts_on: '2000-09-01', ends_on: '2001-07-31', status });

const failure = (status: number, code?: string) =>
  new AxiosError('x', 'ERR_BAD_REQUEST', undefined, null, { data: code ? { error: 'x', code } : {}, status, statusText: '', headers: {}, config: {} as never });

describe('Vorauswahl des Schuljahres', () => {
  it('waehlt das laufende Schuljahr', () => {
    expect(defaultSchoolYear([year('a', 'past'), year('b', 'running'), year('c', 'upcoming')])?.id).toBe('b');
  });

  it('waehlt ohne laufendes das zuletzt vergangene (die API liefert nach Beginn aufsteigend)', () => {
    expect(defaultSchoolYear([year('a', 'past'), year('b', 'past')])?.id).toBe('b');
  });

  it('waehlt nichts, wenn es kein laufendes und kein vergangenes Schuljahr gibt', () => {
    expect(defaultSchoolYear([])).toBeUndefined();
    expect(defaultSchoolYear([year('a', 'upcoming')])).toBeUndefined();
  });
});

describe('Pruefung des Formulars', () => {
  it.each([
    ['7', '7a'],
    ['1', 'a'],
    ['13', '12345678901234567890'],
    ['7', '  7a  ']
  ])('akzeptiert Stufe %s und Bezeichnung "%s"', (grade, name) => {
    expect(classFormProblem(grade, name)).toBeUndefined();
  });

  it.each([['', '7a'], ['0', '7a'], ['14', '7a'], ['7.5', '7a'], ['-1', '7a'], ['abc', '7a']])('lehnt die Stufe "%s" ab', (grade, name) => {
    expect(classFormProblem(grade, name)).toMatch(/Klassenstufe/);
  });

  it('lehnt eine leere oder zu lange Bezeichnung ab, gezaehlt nach dem Trimmen', () => {
    expect(classFormProblem('7', '   ')).toMatch(/Bezeichnung/);
    expect(classFormProblem('7', '123456789012345678901')).toMatch(/höchstens 20 Zeichen/);
  });
});

describe('Fehlertexte beim Anlegen', () => {
  it.each([
    ['class_name_taken', /bereits eine Klasse mit dieser Bezeichnung/],
    ['school_year_not_found', /Schuljahr gibt es nicht/],
    ['forbidden', /Klassen verwalten/],
    ['invalid_request', /Klassenstufe/]
  ])('uebersetzt %s', (code, text) => {
    expect(describeClassFailure(failure(400, code))).toMatch(text);
  });

  it('faellt bei unbekanntem Code oder ohne Antwort auf einen allgemeinen Text zurueck', () => {
    expect(describeClassFailure(failure(500))).toMatch(/Die Klasse konnte nicht angelegt werden/);
    expect(describeClassFailure(new Error('offline'))).toMatch(/Die Klasse konnte nicht angelegt werden/);
  });
});
