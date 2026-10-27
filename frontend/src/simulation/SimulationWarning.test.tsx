import { describe, expect, it } from 'vitest';
import type { Conjunction } from '../data/conjunction-client.js';
import { goThereView, watchView } from './warning-views.js';

const T0 = Date.parse('2026-09-30T02:51:56Z');
const C: Conjunction = {
  tcaMs: T0, missDistanceKm: 0.028, relativeSpeedKmS: 13.07, maximumPc: 0.313, aspectRatio: 3, hardBodyRadiusKm: 0.02,
  dilutionSigmaKm: 0.0114, valid2d: true, validityReason: null, method: 'm',
  primary: { noradId: '53252', name: 'A', elementSetEpochMs: 0 }, secondary: { noradId: '58000', name: 'B', elementSetEpochMs: 0 },
};
const RUN = { completedAtMs: 0, windowStartMs: T0 - 6e7, windowEndMs: T0 + 2.6e7, reportingDistanceKm: 5 };

describe('watchView', () => {
  it('jumps to 30 s before closest approach at real speed, following the selected party', () => {
    expect(watchView(C, '58000')).toEqual({ selected: '58000', epochMs: T0 - 30_000, rate: 1, paused: false });
    expect(watchView(C, null).selected).toBe('53252');
  });
});

describe('goThereView', () => {
  it('starts at the window start, keeping a forward rate, never selecting', () => {
    expect(goThereView(RUN, 3600)).toEqual({ selected: null, epochMs: RUN.windowStartMs, rate: 3600, paused: false });
    expect(goThereView(RUN, 0).rate).toBe(1);
    expect(goThereView(RUN, -60).rate).toBe(1);
  });
});
