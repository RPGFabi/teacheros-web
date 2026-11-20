import { describe, expect, it } from 'vitest';
import { defaultSchoolYear, statusLabel, statusVariant } from './schoolYear';

const year = (id: string, status: string) => ({ id, name: id, starts_on: '2000-09-01', ends_on: '2001-07-31', status });

describe('Status und Anzeige', () => {
  it('uebersetzt den Status der API in deutsche Begriffe des Glossars', () => {
    expect(statusLabel('running')).toBe('laufend');
    expect(statusLabel('upcoming')).toBe('kommend');
    expect(statusLabel('past')).toBe('vergangen');
    expect(statusLabel('irgendwas')).toBe('irgendwas');
  });

  it('faerbt den Status-Badge je Status, unbekannte neutral', () => {
    expect(statusVariant('running')).toBe('success');
    expect(statusVariant('upcoming')).toBe('primary');
    expect(statusVariant('past')).toBe('neutral');
    expect(statusVariant('irgendwas')).toBe('neutral');
    expect(statusVariant('constructor')).toBe('neutral');
  });
});

describe('Vorauswahl des Schuljahres', () => {
  it('waehlt das laufende Schuljahr', () => {
    expect(defaultSchoolYear([year('a', 'past'), year('b', 'running'), year('c', 'upcoming')])?.id).toBe('b');
  });

  it('waehlt ohne laufendes das zuletzt vergangene (die API liefert nach Beginn aufsteigend)', () => {
    expect(defaultSchoolYear([year('a', 'past'), year('b', 'past'), year('c', 'upcoming')])?.id).toBe('b');
  });

  it('waehlt ohne laufendes und ohne vergangenes das naechste kommende, also das erste', () => {
    expect(defaultSchoolYear([year('a', 'upcoming'), year('b', 'upcoming')])?.id).toBe('a');
  });

  it('waehlt nichts, wenn es kein Schuljahr gibt', () => {
    expect(defaultSchoolYear([])).toBeUndefined();
  });
});
