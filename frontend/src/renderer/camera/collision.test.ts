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
  it('is zero when either camera endpoint already clears R_earth + 200 (the common Earth→satellite case)', () => {
    expect(requiredExtraSwellGain(R_EARTH_A_KM + 500, 40000)).toBe(0);
    expect(requiredExtraSwellGain(R_EARTH_A_KM + 300, R_EARTH_A_KM + 250)).toBe(0);
  });

  it('is positive when BOTH camera endpoints sit below the 200 km clearance — lifts the arc over the limb', () => {
    const low = R_EARTH_A_KM + 150; // camera framing two very-low-LEO objects
    const gain = requiredExtraSwellGain(low, low);
    expect(gain).toBeGreaterThan(0);
    expect(low * (1 + gain)).toBeGreaterThanOrEqual(R_EARTH_A_KM + 200 - 1e-3);
  });
});

// Tested against the two floors that actually ship — freeOrbit's
// R_earth + 120 km and object mode's 1.8 x the 10 m proxy radius — not a
// degenerate rMin of 0. The M1.7a review's defect (c) lived exactly in the
// gap between those two scales: a flat band sized for Earth froze zoom-in
// near an object, and a test at rMin = 0 could not see it.
const FREE_ORBIT_FLOOR_KM = R_EARTH_A_KM + 120;
const OBJECT_FLOOR_KM = 0.018;

describe('softRepulsionScale', () => {
  it('leaves the Earth approach exactly as M1.6 tuned it — 300 km, ramping to 0', () => {
    expect(softRepulsionScale(FREE_ORBIT_FLOOR_KM + 300, FREE_ORBIT_FLOOR_KM)).toBe(1);
    expect(softRepulsionScale(FREE_ORBIT_FLOOR_KM + 150, FREE_ORBIT_FLOOR_KM)).toBeCloseTo(0.5, 6);
    expect(softRepulsionScale(FREE_ORBIT_FLOOR_KM, FREE_ORBIT_FLOOR_KM)).toBe(0);
  });

  it('does not resist zoom-in a kilometre from an object', () => {
    expect(softRepulsionScale(1, OBJECT_FLOOR_KM)).toBe(1);
  });

  it('still ramps to 0 at the object floor itself', () => {
    const band = OBJECT_FLOOR_KM * 2;
    expect(softRepulsionScale(OBJECT_FLOOR_KM + band / 2, OBJECT_FLOOR_KM)).toBeCloseTo(0.5, 6);
    expect(softRepulsionScale(OBJECT_FLOOR_KM, OBJECT_FLOOR_KM)).toBe(0);
  });

  it('never resists at the object-mode framing distance a fly-to arrives at', () => {
    expect(softRepulsionScale(0.0825, OBJECT_FLOOR_KM)).toBe(1);
  });
});
