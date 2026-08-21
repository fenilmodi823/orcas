import { describe, expect, it } from 'vitest';
import { eciToGeodeticDeg } from '../src/index.js';

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
