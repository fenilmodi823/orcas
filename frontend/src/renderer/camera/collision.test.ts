import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import {
  clampFreeOrbitRadiusKm,
  ellipsoidNormalizedDistance,
  R_EARTH_A_KM,
  requiredExtraSwellGain,
  softRepulsionScale,
} from './collision.js';

describe('clampFreeOrbitRadiusKm', () => {
  it('never lets freeOrbit closer than R_earth + 120 km', () => {
    expect(clampFreeOrbitRadiusKm(100)).toBeCloseTo(R_EARTH_A_KM + 120, 3);
    expect(clampFreeOrbitRadiusKm(50000)).toBe(50000);
  });
});

describe('ellipsoidNormalizedDistance — Earth is 21 km flatter at the poles', () => {
  it('a point on the equatorial radius reads exactly 1', () => {
    expect(ellipsoidNormalizedDistance(new Vector3(6378.137, 0, 0))).toBeCloseTo(1, 6);
  });

  it('a point at the equatorial radius but on the Z axis is OUTSIDE (b < a)', () => {
    expect(ellipsoidNormalizedDistance(new Vector3(0, 0, 6378.137))).toBeGreaterThan(1);
  });

  it('a point at the polar radius on the X axis is INSIDE', () => {
    expect(ellipsoidNormalizedDistance(new Vector3(6356.752, 0, 0))).toBeLessThan(1);
  });
});

describe('requiredExtraSwellGain — low-to-low arc lift', () => {
  it('is zero when either endpoint already clears R_earth + 200', () => {
    expect(requiredExtraSwellGain(R_EARTH_A_KM + 500, R_EARTH_A_KM + 300)).toBe(0);
  });

  it('is positive when BOTH endpoints are low — lifts the arc over the limb', () => {
    const low = R_EARTH_A_KM + 400; // two 400 km LEO objects
    const gain = requiredExtraSwellGain(low, low);
    expect(gain).toBeGreaterThan(0);
    expect(low * (1 + gain)).toBeGreaterThanOrEqual(R_EARTH_A_KM + 200 - 1e-3);
  });
});

describe('softRepulsionScale', () => {
  it('is 1 (no resistance) more than 300 km above the floor', () => {
    expect(softRepulsionScale(1000, 0)).toBe(1);
  });

  it('ramps to 0 as radius approaches the floor', () => {
    expect(softRepulsionScale(150, 0)).toBeCloseTo(0.5, 6);
    expect(softRepulsionScale(0, 0)).toBe(0);
  });
});
