import { describe, expect, it } from 'vitest';
import { satrecFromOmm, propagate, type OmmRecord } from '@orcas/physics';
import {
  DEFAULT_PATH_SAMPLES,
  OrbitPathError,
  orbitalPeriodSec,
  sampleOrbitPath,
  toLineSegments,
} from './orbit-path.js';

/** An ISS-like record. Real numbers where it matters: 15.49 rev/day is the
 * ISS's actual mean motion, so the period assertion below is checkable
 * against a published value rather than against itself. */
function issLikeRecord(overrides: Partial<OmmRecord> = {}): OmmRecord {
  return {
    OBJECT_NAME: 'ISS (ZARYA)',
    OBJECT_ID: '1998-067A',
    EPOCH: '2026-08-13T20:35:52.287648+00:00',
    MEAN_MOTION: 15.49433609,
    ECCENTRICITY: 0.00074948,
    INCLINATION: 51.6326,
    RA_OF_ASC_NODE: 14.6698,
    ARG_OF_PERICENTER: 43.6909,
    MEAN_ANOMALY: 316.4672,
    EPHEMERIS_TYPE: 0,
    CLASSIFICATION_TYPE: 'U',
    NORAD_CAT_ID: '25544',
    ELEMENT_SET_NO: 999,
    REV_AT_EPOCH: 58069,
    BSTAR: 0.000085019655,
    MEAN_MOTION_DOT: 0.00004307,
    MEAN_MOTION_DDOT: 0,
    ...overrides,
  };
}

const EPOCH_MS = Date.parse('2026-08-13T20:35:52.287Z');

describe('orbitalPeriodSec', () => {
  // The ISS orbits about every 93 minutes. If this ever drifts far from
  // that, the path spans the wrong stretch of orbit and everything drawn
  // from it is wrong in a way that still looks like an orbit.
  it('gives the ISS its real ~93 minute period', () => {
    const minutes = orbitalPeriodSec(issLikeRecord()) / 60;
    expect(minutes).toBeGreaterThan(92);
    expect(minutes).toBeLessThan(94);
  });

  it('gives a geostationary object a sidereal day', () => {
    const hours = orbitalPeriodSec(issLikeRecord({ MEAN_MOTION: 1.0027 })) / 3600;
    expect(hours).toBeCloseTo(23.934, 2);
  });

  it('refuses a mean motion that cannot describe an orbit', () => {
    expect(() => orbitalPeriodSec(issLikeRecord({ MEAN_MOTION: 0 }))).toThrow(RangeError);
    expect(() => orbitalPeriodSec(issLikeRecord({ MEAN_MOTION: -1 }))).toThrow(RangeError);
  });
});

describe('sampleOrbitPath', () => {
  const record = issLikeRecord();
  const satrec = satrecFromOmm(record);
  const path = sampleOrbitPath({ satrec, record, noradId: '25544', atMs: EPOCH_MS });

  it('fills three floats per sample', () => {
    expect(path.length).toBe(DEFAULT_PATH_SAMPLES * 3);
    expect([...path].every(Number.isFinite)).toBe(true);
  });

  // Every sample must sit at a plausible orbital radius. A path that wanders
  // through the Earth or out to the Moon is the signature of a unit or frame
  // mistake, which is otherwise invisible against a black sky.
  it('stays on a real LEO shell the whole way round', () => {
    for (let i = 0; i < DEFAULT_PATH_SAMPLES; i++) {
      const r = Math.hypot(path[i * 3], path[i * 3 + 1], path[i * 3 + 2]);
      expect(r).toBeGreaterThan(6600); // above the surface
      expect(r).toBeLessThan(7100); // still LEO
    }
  });

  // The span is centred on `atMs`, so the object's own position at that
  // instant must lie on its path — near the middle. This is the assertion
  // that catches an off-by-half-a-period, which otherwise draws a perfectly
  // convincing orbit that the satellite is simply not on.
  it('passes through the object own position at the sampled instant', () => {
    const now = propagate(satrec, new Date(EPOCH_MS), '25544').positionEciKm;
    let best = Infinity;
    let bestIndex = -1;
    for (let i = 0; i < DEFAULT_PATH_SAMPLES; i++) {
      const d = Math.hypot(path[i * 3] - now.x, path[i * 3 + 1] - now.y, path[i * 3 + 2] - now.z);
      if (d < best) {
        best = d;
        bestIndex = i;
      }
    }
    // Between samples the object moves ~7.66 km/s x (93 min / 179) ≈ 239 km,
    // so the closest sample is within half of that.
    expect(best).toBeLessThan(130);
    expect(bestIndex).toBeGreaterThan(DEFAULT_PATH_SAMPLES / 2 - 2);
    expect(bestIndex).toBeLessThan(DEFAULT_PATH_SAMPLES / 2 + 2);
  });

  // Not a defect — the point of the "orbits do not close" note in the module
  // docstring. Drag and nodal regression move the object between one period
  // and the next, and the gap is left alone rather than sewn shut.
  it('does not close: one period later the object has moved on', () => {
    const first = [path[0], path[1], path[2]];
    const last = [
      path[(DEFAULT_PATH_SAMPLES - 1) * 3],
      path[(DEFAULT_PATH_SAMPLES - 1) * 3 + 1],
      path[(DEFAULT_PATH_SAMPLES - 1) * 3 + 2],
    ];
    const gap = Math.hypot(first[0] - last[0], first[1] - last[1], first[2] - last[2]);
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThan(200); // real, but small — not a wild discontinuity
  });

  it('reuses a caller-owned buffer, allocating nothing on the resample cadence', () => {
    const buffer = new Float32Array(DEFAULT_PATH_SAMPLES * 3);
    const result = sampleOrbitPath({ satrec, record, noradId: '25544', atMs: EPOCH_MS, out: buffer });
    expect(result).toBe(buffer);
  });

  it('refuses a buffer too small to hold the path', () => {
    expect(() =>
      sampleOrbitPath({ satrec, record, noradId: '25544', atMs: EPOCH_MS, out: new Float32Array(9) }),
    ).toThrow(RangeError);
  });

  it('needs at least two samples to be a line', () => {
    expect(() => sampleOrbitPath({ satrec, record, noradId: '25544', atMs: EPOCH_MS, samples: 1 })).toThrow(
      RangeError,
    );
  });

  // All-or-nothing: half a path drawn without complaint looks like an orbit
  // that really does stop there.
  it('throws rather than returning a partial path when propagation fails', () => {
    // A decayed orbit: mean motion far above anything that can still be in
    // orbit, which SGP4's decay check rejects.
    const decayed = issLikeRecord({ MEAN_MOTION: 20.5, BSTAR: 0.9 });
    expect(() =>
      sampleOrbitPath({
        satrec: satrecFromOmm(decayed),
        record: decayed,
        noradId: '99999',
        atMs: EPOCH_MS + 400 * 86_400_000,
      }),
    ).toThrow(OrbitPathError);
  });
});

describe('toLineSegments', () => {
  it('turns N points into N-1 segments sharing their endpoints', () => {
    const points = new Float32Array([0, 0, 0, 1, 1, 1, 2, 2, 2]);
    const segments = toLineSegments(points, 3);
    expect([...segments]).toEqual([0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2]);
  });

  it('refuses a buffer too small for the segments', () => {
    expect(() => toLineSegments(new Float32Array(9), 3, new Float32Array(6))).toThrow(RangeError);
  });
});
