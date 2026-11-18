import { describe, expect, it } from 'vitest';
import { errorCode, errorReason } from './errors';

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
