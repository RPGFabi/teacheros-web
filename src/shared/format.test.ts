import { describe, expect, it } from 'vitest';
import { formatDay } from './format';

describe('formatDay', () => {
  it('formatiert einen Kalendertag ohne Zeitzonenverschiebung', () => {
    expect(formatDay('2026-09-14')).toBe('14.09.2026');
    expect(formatDay('2027-01-01')).toBe('01.01.2027');
  });
});
