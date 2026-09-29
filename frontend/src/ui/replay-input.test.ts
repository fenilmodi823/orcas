import { describe, expect, it } from 'vitest';
import { parseUtcDateTimeLocal, toUtcDateTimeLocal } from './replay-input.js';

describe('replay input — datetime-local read as UTC', () => {
  it('reads the value as UTC, not the browser time zone', () => {
    expect(parseUtcDateTimeLocal('2026-09-20T12:30')).toBe(Date.UTC(2026, 8, 20, 12, 30));
    expect(parseUtcDateTimeLocal('2026-09-20T12:30:15')).toBe(Date.UTC(2026, 8, 20, 12, 30, 15));
  });

  it('rejects empty and malformed values', () => {
    for (const bad of ['', '2026-09-20', 'yesterday', '2026-13-40T99:99']) {
      expect(parseUtcDateTimeLocal(bad)).toBeNull();
    }
  });

  it('round-trips to the minute', () => {
    const ms = Date.UTC(2026, 8, 20, 12, 30);
    expect(toUtcDateTimeLocal(ms)).toBe('2026-09-20T12:30');
    expect(parseUtcDateTimeLocal(toUtcDateTimeLocal(ms))).toBe(ms);
  });
});
