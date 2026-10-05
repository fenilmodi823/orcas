import { describe, expect, it } from 'vitest';
import { parseUtcInput } from './utc-input.js';

describe('parseUtcInput (typed time is UTC, A.11)', () => {
  it('reads the clock’s own format back', () => {
    expect(parseUtcInput('2026-10-03 13:11:46 UTC')).toBe(Date.UTC(2026, 9, 3, 13, 11, 46));
    expect(parseUtcInput('2026-10-03 13:11:46')).toBe(Date.UTC(2026, 9, 3, 13, 11, 46));
  });

  it('accepts ISO, minutes only, a bare date, and a Z or UTC suffix', () => {
    expect(parseUtcInput('2026-10-03T13:11:46Z')).toBe(Date.UTC(2026, 9, 3, 13, 11, 46));
    expect(parseUtcInput('2026-10-03 13:11')).toBe(Date.UTC(2026, 9, 3, 13, 11, 0));
    expect(parseUtcInput(' 2026-10-03 ')).toBe(Date.UTC(2026, 9, 3));
    expect(parseUtcInput('2026-10-03 13:11 utc')).toBe(Date.UTC(2026, 9, 3, 13, 11, 0));
  });

  it('rejects anything it would have to guess at', () => {
    expect(parseUtcInput('')).toBeNull();
    expect(parseUtcInput('Oct 3 2026')).toBeNull(); // no locale guessing
    expect(parseUtcInput('2026-02-30 00:00')).toBeNull(); // no such day
    expect(parseUtcInput('2026-10-03 24:00')).toBeNull();
    expect(parseUtcInput('2026-10-03 13:11:46+05:30')).toBeNull(); // UTC only
  });
});
