import { describe, expect, it } from 'vitest';
import { computeNearFarKm } from './near-far.js';

describe('computeNearFarKm', () => {
  it('wide Earth view (camera 42,000 km out, nearest surface = Earth ~35,600 km away): far covers GEO', () => {
    const { nearKm, farKm } = computeNearFarKm(35629, 42000);
    expect(farKm).toBeGreaterThan(42164); // past the GEO ring
    expect(nearKm).toBeGreaterThan(1);
  });

  it('orbiting a satellite 0.45 km away: near shrinks so the target is not clipped', () => {
    const { nearKm } = computeNearFarKm(0.45, 6871);
    expect(nearKm).toBeLessThan(0.45);
    expect(nearKm).toBeGreaterThanOrEqual(0.001); // never below 1 m
  });

  it('far always reaches at least past GEO even from a low vantage', () => {
    const { farKm } = computeNearFarKm(100, 6871);
    expect(farKm).toBeGreaterThanOrEqual(42164);
  });

  it('near is floored at 1 m', () => {
    expect(computeNearFarKm(0.0001, 6800).nearKm).toBe(0.001);
  });
});
