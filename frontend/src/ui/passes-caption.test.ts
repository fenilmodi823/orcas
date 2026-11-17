import { describe, expect, it } from 'vitest';
import { passesSummary, screenedCaption } from './passes-caption.js';

const start = Date.parse('2026-11-03T14:27:36Z');
const end = Date.parse('2026-11-04T14:27:36Z');

describe('the passes list in words (Stage B §5.5)', () => {
  it('sums the collapsed list in one line', () => {
    expect(passesSummary(10, start, end)).toBe('10 close passes, screened 3–4 Nov 2026');
    expect(passesSummary(1, start, end)).toBe('1 close pass, screened 3–4 Nov 2026');
  });
  it('spans months when the window does', () => {
    expect(passesSummary(2, Date.parse('2026-10-31T20:00:00Z'), Date.parse('2026-11-01T20:00:00Z'))).toBe('2 close passes, screened 31 Oct – 1 Nov 2026');
  });
  it('keeps the start year when the window crosses a year', () => {
    expect(passesSummary(3, Date.parse('2026-12-31T20:00:00Z'), Date.parse('2027-01-01T20:00:00Z'))).toBe('3 close passes, screened 31 Dec 2026 – 1 Jan 2027');
  });
  it('captions the screened window in full', () => {
    const done = end + 3_600_000;
    // Counted from the run's completion, as the quiet line counts it, not from the window's end.
    expect(screenedCaption(start, end, done, done + 3 * 86_400_000)).toBe('Screened 2026-11-03 14:27:36 to 2026-11-04 14:27:36 UTC, 3 days ago.');
    expect(screenedCaption(start, end, done, done + 2 * 86_400_000 - 1)).toMatch(/, 1 day ago\.$/);
  });
});
