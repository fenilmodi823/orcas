import { describe, expect, it } from 'vitest';
import { chooseStepSeconds } from './step-size.js';

describe('chooseStepSeconds', () => {
  // The brief's table (§A.5) is derived for a genuinely circular orbit
  // (e=0) — the perigee-rate correction below is a real, separate effect
  // that scales h even at tiny eccentricities, so these use e=0 exactly
  // to isolate what the table actually claims.
  it("matches the brief's table: LEO circular at 1x -> ~31s", () => {
    // 94.6 min period -> mean motion = 1440/94.6 rev/day.
    const meanMotion = 1440 / 94.6;
    const h = chooseStepSeconds(meanMotion, 0, 1);
    expect(h).toBeCloseTo(31.53, 1);
  });

  it("matches the brief's table: LEO circular at 3600x -> 900s", () => {
    const meanMotion = 1440 / 94.6;
    const h = chooseStepSeconds(meanMotion, 0, 3600);
    expect(h).toBeCloseTo(900, 0);
  });

  it("matches the brief's table: LEO circular at 600x -> ~150s", () => {
    const meanMotion = 1440 / 94.6;
    const h = chooseStepSeconds(meanMotion, 0, 600);
    expect(h).toBeCloseTo(150, 0);
  });

  it('tightens h by ~9.95x for a Molniya-class eccentricity (e=0.74)', () => {
    // Same period/rate as the circular case above, only eccentricity
    // differs, isolating the perigee-rate scaling factor.
    const meanMotion = 1440 / 94.6;
    const hCircular = chooseStepSeconds(meanMotion, 0.001, 1);
    const hMolniya = chooseStepSeconds(meanMotion, 0.74, 1);
    expect(hCircular / hMolniya).toBeCloseTo(9.95, 1);
  });
});
