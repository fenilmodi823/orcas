import { describe, expect, it } from 'vitest';
import { ObjType, OrbitClass, type ObjectMeta } from '../../data/catalog-types.js';
import { resolveSelectableObject } from './points-selection-resolve.js';

const WGS84_EQUATORIAL_RADIUS_KM = 6378.137;

// The exact shape the backend emits — verified against a live
// GET /api/v1/catalog/snapshot, not invented. The offset suffix, not a
// trailing 'Z', is what broke the shipped parser.
const REAL_EPOCH = '2026-08-01T00:00:00.287648+00:00';

function fakeObject(overrides: Partial<ObjectMeta> = {}): ObjectMeta {
  return {
    norad: '25544' as ObjectMeta['norad'],
    name: 'ISS (ZARYA)',
    objectId: '1998-067A',
    type: ObjType.Payload,
    orbitClass: OrbitClass.LEO,
    isActive: true,
    sourceType: 'live',
    source: 'celestrak',
    epochMs: Date.parse(REAL_EPOCH),
    record: {
      OBJECT_NAME: 'ISS (ZARYA)',
      OBJECT_ID: '1998-067A',
      EPOCH: REAL_EPOCH,
      MEAN_MOTION: 15.5,
      ECCENTRICITY: 0.0004,
      INCLINATION: 51.6,
      RA_OF_ASC_NODE: 247.46,
      ARG_OF_PERICENTER: 130.5,
      MEAN_ANOMALY: 325.0,
      EPHEMERIS_TYPE: 0,
      CLASSIFICATION_TYPE: 'U',
      NORAD_CAT_ID: '25544',
      ELEMENT_SET_NO: 999,
      REV_AT_EPOCH: 1000,
      BSTAR: 2e-5,
      MEAN_MOTION_DOT: 1e-5,
      MEAN_MOTION_DDOT: 0,
    },
    ...overrides,
  };
}

describe('resolveSelectableObject', () => {
  it('resolves the display shape from real ObjectMeta and live FrameState', () => {
    const objects = [fakeObject()];
    const byNorad = { '25544': 0 };
    // On the equator, 419 km above the WGS84 ellipsoid (the ISS band); speed 7.66 km/s.
    const altitudeKm = 419.0;
    const frameState = {
      positions: new Float32Array([WGS84_EQUATORIAL_RADIUS_KM + altitudeKm, 0, 0]),
      velocities: new Float32Array([0, 7.66, 0]),
    };

    const resolved = resolveSelectableObject('25544' as never, objects, byNorad, frameState);

    expect(resolved).not.toBeNull();
    expect(resolved!.name).toBe('ISS (ZARYA)');
    expect(resolved!.noradId).toBe('25544');
    expect(resolved!.orbitClass).toBe('leo');
    expect(resolved!.altitudeKm).toBeCloseTo(altitudeKm, 2);
    expect(resolved!.velocityKmS).toBeCloseTo(7.66, 5);
    expect(resolved!.inclinationDeg).toBeCloseTo(51.6, 5);
  });

  it('returns null for a NORAD id not present in byNorad (e.g. it decayed out of the catalogue)', () => {
    const objects = [fakeObject()];
    const byNorad = { '25544': 0 };
    const frameState = { positions: new Float32Array(3), velocities: new Float32Array(3) };
    expect(resolveSelectableObject('99999' as never, objects, byNorad, frameState)).toBeNull();
  });

  it("classifies debris distinctly from its orbit class, matching M1.4's classifyOrbitClass rule", () => {
    const objects = [fakeObject({ type: ObjType.Debris, orbitClass: OrbitClass.GEO })];
    const byNorad = { '25544': 0 };
    const frameState = {
      positions: new Float32Array([WGS84_EQUATORIAL_RADIUS_KM + 100, 0, 0]),
      velocities: new Float32Array([0, 1, 0]),
    };
    const resolved = resolveSelectableObject('25544' as never, objects, byNorad, frameState);
    expect(resolved!.orbitClass).toBe('debris');
  });

  it('returns null while the object has no computed position yet', () => {
    // A FrameState slot the loop has never written is all zeros, and the
    // Earth's centre read as an altitude is -6356.8 km (seen live on a cold
    // start, 2026-10-03). Nothing in orbit sits at the origin.
    const frameState = { positions: new Float32Array(3), velocities: new Float32Array(3) };
    expect(resolveSelectableObject('25544' as never, [fakeObject()], { '25544': 0 }, frameState)).toBeNull();
  });

  it('measures altitude from the WGS84 ellipsoid, not a sphere', () => {
    // |r| = 6371 + 419 on the equator used to read "419 km". The equatorial
    // radius is 6378.137 km, so the true altitude there is 411.863 km.
    const frameState = {
      positions: new Float32Array([6371 + 419, 0, 0]),
      velocities: new Float32Array([0, 7.66, 0]),
    };

    const resolved = resolveSelectableObject('25544' as never, [fakeObject()], { '25544': 0 }, frameState);

    expect(resolved!.altitudeKm).toBeCloseTo(411.863, 2);
  });
});

