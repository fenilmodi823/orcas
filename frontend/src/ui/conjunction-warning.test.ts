import { describe, expect, it } from 'vitest';
import type { Conjunction } from '../data/conjunction-client.js';
import {
  leadMs, MIN_LEAD_MS, NASA_PC_THRESHOLD, pickWarning, warningCandidates, warningKey, watchTarget,
} from './conjunction-warning.js';

const T0 = Date.parse('2026-09-30T02:51:56Z');
function pass(tcaMs: number, overrides: Partial<Conjunction> = {}): Conjunction {
  return {
    tcaMs, missDistanceKm: 0.028, relativeSpeedKmS: 13.07, maximumPc: 0.313, aspectRatio: 3,
    hardBodyRadiusKm: 0.02, dilutionSigmaKm: 0.0114, valid2d: true, validityReason: null,
    method: 'Upper bound over uncertainty ellipses of 3:1 aspect ratio (Alfano 2005).',
    primary: { noradId: '53252', name: 'STARLINK-4158', elementSetEpochMs: T0 - 86_400_000 },
    secondary: { noradId: '58000', name: 'PELICAN-6', elementSetEpochMs: T0 - 43_200_000 },
    ...overrides,
  };
}
const none = new Set<string>();

describe('warningCandidates', () => {
  it('keeps exactly the passes at or above NASA\'s line, never a null maximum', () => {
    const at = pass(T0, { maximumPc: NASA_PC_THRESHOLD });
    const below = pass(T0 + 1, { maximumPc: 9.99e-5 });
    const nul = pass(T0 + 2, { maximumPc: null, valid2d: false });
    expect(warningCandidates([at, below, nul], [])).toEqual([at]);
  });

  it('shows a pass on both lists once, and sorts by closest approach', () => {
    const late = pass(T0 + 60_000);
    const early = pass(T0);
    expect(warningCandidates([late, early], [early])).toEqual([early, late]);
  });
});

describe('leadMs', () => {
  it('is 10 simulated minutes at real speed, 20 real seconds when faster, either direction', () => {
    expect(leadMs(0)).toBe(MIN_LEAD_MS);
    expect(leadMs(1)).toBe(MIN_LEAD_MS);
    expect(leadMs(3600)).toBe(72_000_000);
    expect(leadMs(-86_400)).toBe(1_728_000_000);
  });
});

describe('pickWarning', () => {
  const a = pass(T0);
  const b = pass(T0 + 3_600_000);
  const base = { candidates: [a, b], rate: 1, dismissed: none, shownKey: null };

  it('shows a pass exactly at the lead edge, not one millisecond before it', () => {
    expect(pickWarning({ ...base, nowMs: T0 - MIN_LEAD_MS })?.conjunction).toBe(a);
    expect(pickWarning({ ...base, nowMs: T0 - MIN_LEAD_MS - 1 })).toBeNull();
  });

  it('calls a pass at exactly now upcoming', () => {
    expect(pickWarning({ ...base, nowMs: T0 })).toEqual({ conjunction: a, phase: 'upcoming' });
  });

  it('keeps the shown pass as passed until the next one is due', () => {
    const shownKey = warningKey(a);
    expect(pickWarning({ ...base, nowMs: T0 + 1, shownKey })).toEqual({ conjunction: a, phase: 'passed' });
    expect(pickWarning({ ...base, nowMs: b.tcaMs - MIN_LEAD_MS, shownKey })?.conjunction).toBe(b);
  });

  it('never conjures "passed" for a pass that was not shown (a jump past it)', () => {
    expect(pickWarning({ ...base, nowMs: T0 + 1 })).toBeNull();
  });

  it('skips a dismissed pass', () => {
    const dismissed = new Set([warningKey(a)]);
    expect(pickWarning({ ...base, rate: 3600, nowMs: T0 - 1, dismissed })?.conjunction).toBe(b);
  });

  it('raises nothing new while time runs backwards, but keeps the one on screen', () => {
    expect(pickWarning({ ...base, rate: -1, nowMs: T0 - 1 })).toBeNull();
    const shownKey = warningKey(a);
    expect(pickWarning({ ...base, rate: -1, nowMs: T0 - 1, shownKey })).toEqual({ conjunction: a, phase: 'upcoming' });
    expect(pickWarning({ ...base, rate: -1, nowMs: T0 + 1, shownKey })).toEqual({ conjunction: a, phase: 'passed' });
  });

  it('shows a due pass while paused (rate 0) and nothing for an empty list', () => {
    expect(pickWarning({ ...base, rate: 0, nowMs: T0 - 60_000 })?.conjunction).toBe(a);
    expect(pickWarning({ ...base, candidates: [], nowMs: T0 })).toBeNull();
  });
});

describe('watchTarget', () => {
  it('follows the selected object when it is in the pair, otherwise the primary', () => {
    const c = pass(T0);
    expect(watchTarget(c, '58000')).toEqual({ follow: c.secondary, counterpart: c.primary });
    expect(watchTarget(c, '53252')).toEqual({ follow: c.primary, counterpart: c.secondary });
    expect(watchTarget(c, null)).toEqual({ follow: c.primary, counterpart: c.secondary });
  });
});
