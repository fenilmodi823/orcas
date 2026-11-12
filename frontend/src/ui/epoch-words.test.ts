import { describe, expect, it } from 'vitest';
import { epochWords } from './epoch-words.js';

const epoch = new Date('2026-11-02T16:18:00Z');
const day = 86_400_000;

describe('epochWords (Stage B §5.3)', () => {
  it('names the epoch as words plus a measurement', () => {
    expect(epochWords(epoch, epoch.getTime() + 3_600_000, false)).toEqual({ label: 'Elements as of', value: '16:18:00 UTC', age: null });
  });
  it('writes the date out when the epoch is not today', () => {
    expect(epochWords(epoch, epoch.getTime() + 2 * day, false).value).toBe('2026-11-02 16:18:00 UTC');
  });
  it('gives a stale epoch its age in words, never colour alone', () => {
    expect(epochWords(epoch, epoch.getTime() + 5 * day + 1000, true).age).toBe('5 days old');
    expect(epochWords(epoch, epoch.getTime() + day + 1000, true).age).toBe('1 day old');
  });
  it('gives a stale epoch under a day its hours', () => {
    expect(epochWords(epoch, epoch.getTime() + 7 * 3_600_000, true).age).toBe('7 hours old');
  });
});
