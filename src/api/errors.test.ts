import { describe, expect, it } from 'vitest';
import { errorCode } from './errors';

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
