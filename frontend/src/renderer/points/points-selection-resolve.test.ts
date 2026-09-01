import { describe, expect, it } from 'vitest';
import { ObjType, Regime, type ObjectMeta } from '../../data/catalog-types.js';
import { resolveObjectDetail, resolveSelectableObject } from './points-selection-resolve.js';

const EARTH_RADIUS_KM = 6371; // same sphere approximation PropagationDebug.tsx already uses

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
    regime: Regime.LEO,
    isActive: true,
    sourceType: 'live',
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
    // Position magnitude EARTH_RADIUS_KM + 419 (ISS altitude), velocity magnitude 7.66 km/s.
    const altitudeKm = 419.0;
    const frameState = {
      positions: new Float32Array([EARTH_RADIUS_KM + altitudeKm, 0, 0]),
      velocities: new Float32Array([0, 7.66, 0]),
    };

    const resolved = resolveSelectableObject('25544' as never, objects, byNorad, frameState);

    expect(resolved).not.toBeNull();
    expect(resolved!.name).toBe('ISS (ZARYA)');
    expect(resolved!.noradId).toBe('25544');
    expect(resolved!.orbitClass).toBe('leo');
    expect(resolved!.altitudeKm).toBeCloseTo(altitudeKm, 5);
    expect(resolved!.velocityKmS).toBeCloseTo(7.66, 5);
    expect(resolved!.inclinationDeg).toBeCloseTo(51.6, 5);
  });

  it('returns null for a NORAD id not present in byNorad (e.g. it decayed out of the catalogue)', () => {
    const objects = [fakeObject()];
    const byNorad = { '25544': 0 };
    const frameState = { positions: new Float32Array(3), velocities: new Float32Array(3) };
    expect(resolveSelectableObject('99999' as never, objects, byNorad, frameState)).toBeNull();
  });

  it("classifies debris distinctly from its regime, matching M1.4's classifyOrbitClass rule", () => {
    const objects = [fakeObject({ type: ObjType.Debris, regime: Regime.GEO })];
    const byNorad = { '25544': 0 };
    const frameState = {
      positions: new Float32Array([EARTH_RADIUS_KM + 100, 0, 0]),
      velocities: new Float32Array([0, 1, 0]),
    };
    const resolved = resolveSelectableObject('25544' as never, objects, byNorad, frameState);
    expect(resolved!.orbitClass).toBe('debris');
  });
});

describe('resolveObjectDetail', () => {
  it('reads the Keplerian elements directly off the canonical OMM record — no derivation needed', () => {
    const detail = resolveObjectDetail(fakeObject());
    expect(detail.eccentricity).toBe(0.0004);
    expect(detail.raanDeg).toBe(247.46);
    expect(detail.argPericenterDeg).toBe(130.5);
    expect(detail.meanAnomalyDeg).toBe(325.0);
    expect(detail.epoch).toEqual(new Date(REAL_EPOCH));
  });

  // The M1.7a review's defect (d): the whole route was torn down when the
  // dock expanded, because StatusPill called toISOString() on an Invalid
  // Date. Re-parsing record.EPOCH produced one for every real record —
  // '…+00:00' + 'Z' does not parse. Only the offset form discriminates,
  // which is why the old fixture's offset-less epoch passed.
  it('yields a valid Date for the offset form the backend actually emits', () => {
    const detail = resolveObjectDetail(fakeObject());
    expect(Number.isNaN(detail.epoch.getTime())).toBe(false);
    expect(() => detail.epoch.toISOString()).not.toThrow();
  });

  it('omits Pc/D_M — no conjunction screening exists yet (Phase 5)', () => {
    const detail = resolveObjectDetail(fakeObject());
    expect(detail.mahalanobisDistance).toBeUndefined();
    expect(detail.probabilityOfCollision).toBeUndefined();
  });
});
