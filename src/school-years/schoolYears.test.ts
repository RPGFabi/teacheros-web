import { describe, expect, it } from 'vitest';
import { describeSchoolYearFailure, formatDay, previewName, statusLabel } from './schoolYears';

describe('Vorschau der Bezeichnung (wie die API: Jahr des Beginns / letzte zwei Ziffern des Endjahres)', () => {
  it('erzeugt 2026/27 aus 14.09.2026 bis 29.07.2027', () => {
    expect(previewName('2026-09-14', '2027-07-29')).toEqual({ name: '2026/27' });
  });

  it('behaelt die fuehrende Null beim Jahrhundertwechsel', () => {
    expect(previewName('2099-08-01', '2100-07-31')).toEqual({ name: '2099/00' });
  });

  it('zeigt noch nichts, solange Beginn oder Ende fehlt', () => {
    expect(previewName('', '2027-07-29')).toEqual({});
    expect(previewName('2026-09-14', '')).toEqual({});
  });

  it('weist ein Ende ausserhalb des Folgejahres mit Hinweis zurueck', () => {
    for (const end of ['2026-12-31', '2026-07-29', '2028-01-01']) {
      expect(previewName('2026-09-14', end)).toEqual({ problem: 'Das Ende muss im Kalenderjahr nach dem Beginn liegen.' });
    }
  });

  it('akzeptiert das Ende am letzten Tag des Folgejahres', () => {
    expect(previewName('2026-01-01', '2027-12-31')).toEqual({ name: '2026/27' });
  });

  it('ignoriert kein gueltiges Datum', () => {
    expect(previewName('2026-02-30', '2027-07-29')).toEqual({});
  });
});

describe('Status und Anzeige', () => {
  it('uebersetzt den Status der API in deutsche Begriffe des Glossars', () => {
    expect(statusLabel('running')).toBe('laufend');
    expect(statusLabel('upcoming')).toBe('kommend');
    expect(statusLabel('past')).toBe('vergangen');
    expect(statusLabel('irgendwas')).toBe('irgendwas');
  });

  it('formatiert einen Kalendertag ohne Zeitzonenverschiebung', () => {
    expect(formatDay('2026-09-14')).toBe('14.09.2026');
    expect(formatDay('2027-01-01')).toBe('01.01.2027');
  });
});

describe('Fehlertexte des Anlegens', () => {
  const err = (code: string) => ({ response: { data: { code } } });

  it('erklaert Ueberschneidung, ungueltigen Zeitraum und fehlendes Recht', () => {
    expect(describeSchoolYearFailure(err('school_year_overlap'))).toMatch(/überschneidet sich mit einem bestehenden Schuljahr/);
    expect(describeSchoolYearFailure(err('invalid_period'))).toMatch(/Kalenderjahr nach dem Beginn/);
    expect(describeSchoolYearFailure(err('forbidden'))).toMatch(/Schuljahre verwalten/);
  });

  it('faellt bei unbekanntem Code auf einen allgemeinen Text zurueck', () => {
    expect(describeSchoolYearFailure(err('boom'))).toMatch(/konnte nicht angelegt werden/);
    expect(describeSchoolYearFailure(new Error('netz'))).toMatch(/konnte nicht angelegt werden/);
  });
});

describe('Fehlertexte beim Bearbeiten und Löschen (Ticket #56)', () => {
  const err = (code: string, error = 'x', status = 409) => ({ response: { status, data: { error, code } } });

  it('erklärt die Sperre wegen Klassen beim Löschen und das fehlende Schuljahr', () => {
    expect(describeSchoolYearFailure(err('school_year_has_classes'), 'delete')).toMatch(/hat Klassen, auch archivierte/);
    expect(describeSchoolYearFailure(err('school_year_in_use'), 'delete')).toMatch(/wird noch verwendet/);
    expect(describeSchoolYearFailure(err('school_year_not_found', 'x', 404), 'update')).toMatch(/gibt es nicht mehr/);
  });

  it('zeigt die Meldung der API, wenn ein anderes Modul Einwand erhebt (unbekannter Code mit 409)', () => {
    expect(describeSchoolYearFailure(err('timetable_published', 'Der Stundenplan ist veröffentlicht.'), 'update')).toBe('Der Stundenplan ist veröffentlicht.');
  });

  it('benennt in der allgemeinen Meldung die Aktion', () => {
    expect(describeSchoolYearFailure(err('boom', 'x', 500), 'update')).toMatch(/konnte nicht gespeichert werden/);
    expect(describeSchoolYearFailure(err('boom', 'x', 500), 'delete')).toMatch(/konnte nicht gelöscht werden/);
  });
});
