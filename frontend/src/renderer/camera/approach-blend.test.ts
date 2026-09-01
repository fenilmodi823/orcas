import { describe, expect, it } from 'vitest';
import { APPROACH_BLEND, blendRadiusKm } from './flight-path.js';

/** The real span of a fly-to from the default free-orbit view to an object:
 * R_GEO down to the object-mode framing distance. Measured on /points. */
const R_START = 42164;
const R_END = 0.0825;

/** Apparent size goes as 1/r, so this is the quantity the eye actually
 * reads. Constants cancel in every ratio below, so 1/r stands in for it. */
const apparent = (r: number) => 1 / r;

describe('blendRadiusKm', () => {
  it('hits both endpoints exactly, whatever the blend', () => {
    for (const p of [0, 0.2, APPROACH_BLEND, 0.7, 1]) {
      expect(blendRadiusKm(R_START, R_END, 0, p)).toBeCloseTo(R_START, 3);
      expect(blendRadiusKm(R_START, R_END, 1, p)).toBeCloseTo(R_END, 6);
    }
  });

  it('closes in monotonically — a flight never backs away from its target', () => {
    for (const p of [0, 0.35, 1]) {
      let previous = Infinity;
      for (let u = 0; u <= 1.0001; u += 0.02) {
        const r = blendRadiusKm(R_START, R_END, Math.min(u, 1), p);
        expect(r).toBeLessThan(previous);
        previous = r;
      }
    }
  });

  // p = 0 must reproduce brief §C.6's geometric curve exactly, so setting the
  // dev-panel slider to zero is a true "before" rather than an approximation.
  it('p = 0 is the geometric curve §C.6 specifies', () => {
    for (const u of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const geometric = Math.exp((1 - u) * Math.log(R_START) + u * Math.log(R_END));
      expect(blendRadiusKm(R_START, R_END, u, 0)).toBeCloseTo(geometric, 6);
    }
  });

  // p = 1 is the other extreme: apparent size grows by equal increments per
  // unit of eased time, which is what "watch it grow" literally means.
  it('p = 1 grows apparent size at a constant rate', () => {
    const step = (u: number) =>
      apparent(blendRadiusKm(R_START, R_END, u + 0.1, 1)) - apparent(blendRadiusKm(R_START, R_END, u, 1));
    const first = step(0.1);
    for (const u of [0.3, 0.5, 0.7, 0.85]) {
      expect(step(u) / first).toBeCloseTo(1, 6);
    }
  });

  /**
   * The property the whole parameter exists for, stated as the thing the
   * M1.7a review actually complained about.
   *
   * An object is worth looking at once it is within ~4 km — that is where a
   * 10 m proxy first subtends the LOD band's 3 px. Under the pure geometric
   * curve that happens deep into the flight, so everything visible is
   * crammed into the tail. Raising the blend moves it earlier, which leaves
   * more of the flight with something on screen to watch.
   */
  it('a higher blend reaches watchable range earlier in the flight', () => {
    const WATCHABLE_KM = 4;
    const uAtWatchable = (p: number) => {
      for (let u = 0; u <= 1; u += 0.001) {
        if (blendRadiusKm(R_START, R_END, u, p) <= WATCHABLE_KM) return u;
      }
      return 1;
    };
    const geometric = uAtWatchable(0);
    const blended = uAtWatchable(APPROACH_BLEND);
    expect(blended).toBeLessThan(geometric);
    // Geometric leaves under a third of the flight to watch; the default
    // blend must at least double that.
    expect(1 - blended).toBeGreaterThan(2 * (1 - geometric));
  });

  it('the shipped default sits between the two extremes, not at one of them', () => {
    expect(APPROACH_BLEND).toBeGreaterThan(0);
    expect(APPROACH_BLEND).toBeLessThan(1);
  });
});
