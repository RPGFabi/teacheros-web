import { AxiosError } from 'axios';
import { describe, expect, it } from 'vitest';
import { classFormProblem, describeClassFailure } from './classes';

const failure = (status: number, code?: string) =>
  new AxiosError('x', 'ERR_BAD_REQUEST', undefined, null, { data: code ? { error: 'x', code } : {}, status, statusText: '', headers: {}, config: {} as never });

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

describe('Fehlertexte der weiteren Aktionen (Ticket #57)', () => {
  it.each([
    ['class_not_found', /gibt es nicht mehr/],
    ['class_archived', /archiviert.*wieder her/],
    ['class_already_archived', /bereits archiviert/],
    ['class_not_archived', /nicht archiviert/],
    ['class_linked', /verknüpft.*Archivieren Sie/]
  ])('uebersetzt %s', (code, text) => {
    expect(describeClassFailure(failure(409, code), 'delete')).toMatch(text);
  });

  it.each([
    ['update', /nicht gespeichert werden/],
    ['archive', /nicht archiviert werden/],
    ['restore', /nicht wiederhergestellt werden/],
    ['delete', /nicht gelöscht werden/]
  ] as const)('nennt bei unbekanntem Fehler je Aktion den passenden allgemeinen Text (%s)', (action, text) => {
    expect(describeClassFailure(failure(500), action)).toMatch(text);
  });
});
