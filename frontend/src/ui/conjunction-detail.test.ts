import { describe, expect, it } from 'vitest';
import type { Conjunction, ConjunctionReport } from '../data/conjunction-client.js';
import { buildConjunctionGroup } from './conjunction-detail.js';

const RUN = {
  completedAtMs: Date.parse('2026-09-27T14:00:00Z'),
  windowStartMs: Date.parse('2026-09-27T13:00:00Z'),
  windowEndMs: Date.parse('2026-09-28T13:00:00Z'),
  reportingDistanceKm: 5,
};

function approach(tcaIso: string, overrides: Partial<Conjunction> = {}): Conjunction {
  return {
    tcaMs: Date.parse(tcaIso),
    missDistanceKm: 0.698,
    relativeSpeedKmS: 11.647,
    maximumPc: 9.06e-4,
    aspectRatio: 3,
    hardBodyRadiusKm: 0.02,
    dilutionSigmaKm: 0.285,
    valid2d: true,
    validityReason: null,
    method: 'Upper bound over uncertainty ellipses of 3:1 aspect ratio (Alfano 2005).',
    primary: { noradId: '24946', name: 'IRIDIUM 33', elementSetEpochMs: Date.parse('2026-09-27T01:00:00Z') },
    secondary: { noradId: '22675', name: 'COSMOS 2251', elementSetEpochMs: Date.parse('2026-09-26T12:00:00Z') },
    ...overrides,
  };
}

const report = (items: Conjunction[], run: ConjunctionReport['run'] = RUN): ConjunctionReport => ({ run, items, rejected: 0 });
const value = (g: ReturnType<typeof buildConjunctionGroup>, label: string) => g.fields.find((f) => f.label === label)?.value;
const NOW = Date.parse('2026-09-27T15:00:00Z');

describe('buildConjunctionGroup', () => {
  it('never lets "not screened" read as "no approaches"', () => {
    const g = buildConjunctionGroup({ kind: 'report', report: report([], null) }, '24946', NOW);
    expect(value(g, 'Status')).toBe('Not screened yet');
    expect(g.note).toMatch(/not the same as no close approaches/);
  });

  it('says so when the backend cannot be reached', () => {
    expect(value(buildConjunctionGroup({ kind: 'unavailable' }, '24946', NOW), 'Status')).toMatch(/Unavailable/);
  });

  it('states the window when nothing came within the reporting distance', () => {
    const g = buildConjunctionGroup({ kind: 'report', report: report([]) }, '24946', NOW);
    expect(value(g, 'Status')).toBe('None within 5 km');
    expect(g.note).toMatch(/Screened 2026-09-27 13:00:00 UTC to 2026-09-28 13:00:00 UTC/);
  });

  it('shows the next approach with everything a maximum P_c needs beside it', () => {
    const items = [approach('2026-09-27T14:00:00Z'), approach('2026-09-27T18:00:00Z'), approach('2026-09-28T02:00:00Z')];
    const g = buildConjunctionGroup({ kind: 'report', report: report(items) }, '24946', NOW);

    expect(value(g, 'Closest approach (TCA)')).toBe('2026-09-27 18:00:00 UTC');
    expect(value(g, 'With')).toBe('COSMOS 2251 (22675)');
    expect(value(g, 'Maximum P_c')).toBe(9.06e-4);
    expect(value(g, 'Assumed ellipse')).toBe('3:1');
    expect(value(g, 'Hard-body radius')).toBe(20);
    expect(value(g, 'Their element set')).toBe('2026-09-26 12:00:00 UTC');
    expect(value(g, 'Approaches in window')).toBe(3);
    expect(g.note).toMatch(/Alfano 2005/);
    expect(g.note).toMatch(/not an operational warning/);
    // A.8: a close miss is not a warning; the two numbers measure different things.
    expect(g.note).toMatch(/Miss distance and maximum P_c are different measurements/);
    expect(g.fields.some((f) => f.label === 'P_c' || f.label === 'Probability')).toBe(false);
  });

  it('names the counterpart from whichever side the selected object is on', () => {
    const g = buildConjunctionGroup({ kind: 'report', report: report([approach('2026-09-27T18:00:00Z')]) }, '22675', NOW);
    expect(value(g, 'With')).toBe('IRIDIUM 33 (24946)');
  });

  it('shows no number outside the 2D model, and says why', () => {
    const slow = approach('2026-09-27T18:00:00Z', {
      maximumPc: null,
      valid2d: false,
      validityReason: 'relative speed 4.0 m/s is below the 10 m/s floor for the 2D model',
    });
    const g = buildConjunctionGroup({ kind: 'report', report: report([slow]) }, '24946', NOW);
    expect(value(g, 'Maximum P_c')).toMatch(/outside 2D model validity/);
    expect(g.note).toMatch(/below the 10 m\/s floor/);
  });

  it('labels the last approach as such once the clock has passed them all', () => {
    const g = buildConjunctionGroup({ kind: 'report', report: report([approach('2026-09-27T14:00:00Z')]) }, '24946', NOW);
    expect(value(g, 'Last screened approach')).toBe('2026-09-27 14:00:00 UTC');
  });
});
