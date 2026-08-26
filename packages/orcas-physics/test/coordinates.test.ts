import { describe, expect, it } from 'vitest';
import { eciToGeodeticDeg, WGS84_A_KM, WGS84_B_KM } from '../src/index.js';

// Same worked example as the backend test and the brief (Part 3.3):
// x=y=0, z=6800 km -> true height z - b, b = 6356.752314245 km.
const B_KM = 6356.752314245;

describe('eciToGeodeticDeg — pole singularity (Bug 2)', () => {
  it('returns the correct altitude at the north pole, not -6399.59 km', () => {
    const geo = eciToGeodeticDeg({ x: 0, y: 0, z: 6800 }, 0);
    expect(geo.altitudeKm).toBeCloseTo(6800 - B_KM, 3);
    expect(geo.latitudeDeg).toBeCloseTo(90, 6);
  });

  it('is symmetric at the south pole', () => {
    const geo = eciToGeodeticDeg({ x: 0, y: 0, z: -6800 }, 0);
    expect(geo.altitudeKm).toBeCloseTo(6800 - B_KM, 3);
    expect(geo.latitudeDeg).toBeCloseTo(-90, 6);
  });
});

describe('WGS84 ellipsoid constants', () => {
  it('exports the exact semi-major axis the brief cites (§F.5)', () => {
    expect(WGS84_A_KM).toBe(6378.137);
  });

  it("exports a semi-minor axis matching the brief's own cited value to 3 decimal places", () => {
    // Brief §F.5 cites 6356.752 (rounded); the exact WGS-84 value is
    // 6356.752314245 — assert the export is that exact value, not a
    // second, independently-rounded copy.
    expect(WGS84_B_KM).toBeCloseTo(6356.752314245, 6);
    expect(WGS84_B_KM).toBeCloseTo(6356.752, 3);
  });
});
