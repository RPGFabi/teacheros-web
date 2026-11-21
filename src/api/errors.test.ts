import { describe, expect, it } from 'vitest';
import { describeFailure, errorCode, errorReason } from './errors';

describe('describeFailure', () => {
  const texts = {
    codes: { forbidden: 'Dafür fehlt das Recht.', school_year_not_found: 'Gibt es nicht mehr.' },
    fallback: { create: 'Anlegen ging schief.', delete: 'Löschen ging schief.' }
  };
  const err = (code: string, error = 'x', status = 400) => ({ response: { status, data: { error, code } } });

  it('liefert den Text zum Fehlercode der API', () => {
    expect(describeFailure(err('forbidden'), 'create', texts)).toBe('Dafür fehlt das Recht.');
  });

  it('faellt bei unbekanntem Code, ohne Code oder ohne Antwort auf den Text der Aktion zurueck', () => {
    expect(describeFailure(err('boom'), 'create', texts)).toBe('Anlegen ging schief.');
    expect(describeFailure(err('boom'), 'delete', texts)).toBe('Löschen ging schief.');
    expect(describeFailure(new Error('netz'), 'delete', texts)).toBe('Löschen ging schief.');
    expect(describeFailure(undefined, 'create', texts)).toBe('Anlegen ging schief.');
  });

  it('haelt Namen der Objekt-Prototypen nicht fuer Codes', () => {
    expect(describeFailure(err('constructor'), 'create', texts)).toBe('Anlegen ging schief.');
    expect(describeFailure(err('toString'), 'create', texts)).toBe('Anlegen ging schief.');
  });

  it('zeigt auf Wunsch bei einem unbekannten Code mit diesem Status die Meldung der API', () => {
    const withMessage = { ...texts, showApiMessageOnStatus: 409 };
    expect(describeFailure(err('modul_einwand', 'Der Stundenplan ist veröffentlicht.', 409), 'delete', withMessage)).toBe('Der Stundenplan ist veröffentlicht.');
    expect(describeFailure(err('modul_einwand', 'Meldung', 500), 'delete', withMessage)).toBe('Löschen ging schief.');
    expect(describeFailure(err('modul_einwand', '', 409), 'delete', withMessage)).toBe('Löschen ging schief.');
    expect(describeFailure(err('forbidden', 'Meldung', 409), 'delete', withMessage)).toBe('Dafür fehlt das Recht.');
  });
});

describe('errorCode', () => {
  it('liest den Code der Fehlerantwort {error, code}', () => {
    expect(errorCode({ response: { data: { error: 'x', code: 'last_admin' } } })).toBe('last_admin');
  });

  it.each([
    ['ohne Antwort (Netzwerkfehler)', new Error('Network Error')],
    ['ohne Code', { response: { data: { error: 'x' } } }],
    ['mit Code, der kein Text ist', { response: { data: { code: 42 } } }],
    ['undefined', undefined],
    ['null', null]
  ])('liefert undefined %s', (_name, err) => {
    expect(errorCode(err)).toBeUndefined();
  });
});

describe('errorReason', () => {
  it('liest den Grund der Fehlerantwort', () => {
    expect(errorReason({ response: { data: { code: 'account_inactive', reason: 'admin_locked' } } })).toBe('admin_locked');
  });

  it.each([
    ['ohne Antwort', new Error('Network Error')],
    ['ohne Grund', { response: { data: { code: 'account_inactive' } } }],
    ['mit Grund null', { response: { data: { reason: null } } }],
    ['undefined', undefined]
  ])('liefert undefined %s', (_name, err) => {
    expect(errorReason(err)).toBeUndefined();
  });
});
