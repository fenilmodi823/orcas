import { describe, expect, it } from 'vitest';
import type { Conjunction, ScreeningRun } from '../data/conjunction-client.js';
import { DISCLAIMER, formatCountdown, quietLine, warningText } from './conjunction-warning-text.js';

const T0 = Date.parse('2026-09-30T02:51:56Z');
const RUN: ScreeningRun = {
  completedAtMs: Date.parse('2026-09-29T10:37:29Z'),
  windowStartMs: Date.parse('2026-09-29T10:02:05Z'),
  windowEndMs: Date.parse('2026-09-30T10:02:05Z'),
  reportingDistanceKm: 5,
};
const C: Conjunction = {
  tcaMs: T0, missDistanceKm: 0.028, relativeSpeedKmS: 13.07, maximumPc: 0.313, aspectRatio: 3,
  hardBodyRadiusKm: 0.02, dilutionSigmaKm: 0.0114, valid2d: true, validityReason: null,
  method: 'Upper bound over uncertainty ellipses of 3:1 aspect ratio (Alfano 2005).',
  primary: { noradId: '53252', name: 'STARLINK-4158', elementSetEpochMs: T0 - 0.99 * 86_400_000 },
  secondary: { noradId: '58000', name: 'PELICAN-6', elementSetEpochMs: T0 - 0.5 * 86_400_000 },
};

describe('formatCountdown', () => {
  it('is mm:ss, then h:mm:ss, then days', () => {
    expect(formatCountdown(252_000)).toBe('04:12');
    expect(formatCountdown(3_723_000)).toBe('1:02:03');
    expect(formatCountdown(90_061_000)).toBe('1 d 01:01:01');
    expect(formatCountdown(-31_000)).toBe('00:31');
  });
});

describe('warningText', () => {
  it('states every number the panel states, in its formatting', () => {
    const t = warningText({ conjunction: C, phase: 'upcoming' }, RUN, T0 - 252_000);
    expect(t).toMatchObject({
      countdown: 'in 04:12', pair: 'STARLINK-4158 and PELICAN-6', miss: '28 m', speed: '13.07 km/s',
      maximumPc: '0.31', aspectRatio: '3:1', hardBodyRadius: '20 m', recordAge: '0.99 days',
      windowStart: '2026-09-29 10:02:05 UTC', windowEnd: '2026-09-30 10:02:05 UTC',
    });
  });

  it('counts up once passed, and never says "probability" without "maximum"', () => {
    const t = warningText({ conjunction: C, phase: 'passed' }, RUN, T0 + 31_000);
    expect(t.countdown).toBe('passed 00:31 ago');
    expect(t.announcement).toBe('Close approach: STARLINK-4158 and PELICAN-6, 28 m apart, maximum P_c 0.31.');
    expect(`${t.announcement} ${DISCLAIMER}`).not.toMatch(/(?<!maximum )probability/i);
  });

  it('refuses a pass with no maximum P_c', () => {
    expect(() => warningText({ conjunction: { ...C, maximumPc: null }, phase: 'upcoming' }, RUN, T0)).toThrow();
  });
});

describe('quietLine', () => {
  const now = Date.parse('2026-10-23T14:00:00Z');
  it('offers Go there outside the window and says how old the screen is', () => {
    expect(quietLine({ kind: 'idle', run: RUN, simulationMs: now }, now)).toEqual({
      text: 'Close-approach warnings cover 2026-09-29 10:02:05 UTC → 2026-09-30 10:02:05 UTC (screened 24 days ago)',
      goThere: true,
    });
  });
  it('says none are due inside the window', () => {
    expect(quietLine({ kind: 'idle', run: RUN, simulationMs: T0 }, now).text).toBe(
      'Close-approach warnings: none due · screened 2026-09-29 10:02:05 UTC → 2026-09-30 10:02:05 UTC');
  });
  it('never reads "not screened" or "unreachable" as all clear', () => {
    expect(quietLine({ kind: 'not-screened' }, now)).toEqual({ text: 'No screening run yet', goThere: false });
    expect(quietLine({ kind: 'unavailable' }, now).text).toBe('Close-approach warnings unavailable: the backend is not reachable');
  });
  it('says "1 day" and "less than a day" correctly', () => {
    const run = { ...RUN, completedAtMs: now - 86_400_000 };
    expect(quietLine({ kind: 'idle', run, simulationMs: now }, now).text).toMatch(/\(screened 1 day ago\)$/);
    expect(quietLine({ kind: 'idle', run: { ...RUN, completedAtMs: now - 1 }, simulationMs: now }, now).text)
      .toMatch(/\(screened less than a day ago\)$/);
  });
});
