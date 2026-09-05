import { describe, expect, it } from 'vitest';
import { satrecFromOmm, propagate, temeToJ2000Matrix, applyMat3, type OmmRecord } from '@orcas/physics';
import { DEFAULT_GROUND_TRACK_SAMPLES, GroundTrackError, sampleGroundTrack } from './ground-track.js';

/** Same ISS-like fixture shape orbit-path.test.ts uses. */
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

describe('sampleGroundTrack', () => {
  const record = issLikeRecord();
  const satrec = satrecFromOmm(record);
  const EARTH_RADIUS_KM = 6371;
  const GROUND_TRACK_OFFSET_KM = 2;

  it('fills the requested number of samples with finite values', () => {
    const { positions, azimuthsRad } = sampleGroundTrack({ satrec, record, noradId: '25544', atMs: EPOCH_MS });
    expect(positions.length).toBe(DEFAULT_GROUND_TRACK_SAMPLES * 3);
    expect(azimuthsRad.length).toBe(DEFAULT_GROUND_TRACK_SAMPLES);
    expect([...positions].every(Number.isFinite)).toBe(true);
    expect([...azimuthsRad].every(Number.isFinite)).toBe(true);
  });

  // Every sample must sit exactly on the Earth's render radius: this is
  // what "under the satellite" means for a radial projection, and it is
  // the assertion that would fail if a future edit swapped in true
  // geodetic lat/lon (a variable-altitude ellipsoid surface) by mistake.
  it('places every sample exactly on the Earth render radius', () => {
    const { positions } = sampleGroundTrack({ satrec, record, noradId: '25544', atMs: EPOCH_MS });
    const expectedRadius = EARTH_RADIUS_KM + GROUND_TRACK_OFFSET_KM;
    for (let i = 0; i < DEFAULT_GROUND_TRACK_SAMPLES; i++) {
      const r = Math.hypot(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      // Float32Array precision, not exactness — matches orbit-path.test.ts's
      // own tolerance for the equivalent check.
      expect(r).toBeCloseTo(expectedRadius, 2);
    }
  });

  // A ground track that isn't radially under its own satellite is the
  // whole-feature-broken case: this checks a sample points in exactly the
  // same direction as the satellite's own J2000 position at that same
  // sample instant (not `atMs` itself — samples land on a step grid, and
  // `atMs` sits between two of them for an even sample count).
  it('sits on the ray from Earth centre through the satellite at the sampled instant', () => {
    const { positions } = sampleGroundTrack({ satrec, record, noradId: '25544', atMs: EPOCH_MS });
    const periodMs = (86_400 / record.MEAN_MOTION) * 1000;
    const stepMs = periodMs / (DEFAULT_GROUND_TRACK_SAMPLES - 1);
    const mid = Math.floor(DEFAULT_GROUND_TRACK_SAMPLES / 2);
    const tMid = new Date(EPOCH_MS - periodMs / 2 + mid * stepMs);
    const satPos = applyMat3(temeToJ2000Matrix(tMid), propagate(satrec, tMid, '25544').positionEciKm);
    const satR = Math.hypot(satPos.x, satPos.y, satPos.z);
    const groundR = EARTH_RADIUS_KM + GROUND_TRACK_OFFSET_KM;
    const expected = {
      x: (satPos.x / satR) * groundR,
      y: (satPos.y / satR) * groundR,
      z: (satPos.z / satR) * groundR,
    };
    const d = Math.hypot(
      positions[mid * 3] - expected.x,
      positions[mid * 3 + 1] - expected.y,
      positions[mid * 3 + 2] - expected.z,
    );
    expect(d).toBeLessThan(0.01);
  });

  it('matches atan2(y, x) of each projected sample', () => {
    const { positions, azimuthsRad } = sampleGroundTrack({ satrec, record, noradId: '25544', atMs: EPOCH_MS });
    for (let i = 0; i < DEFAULT_GROUND_TRACK_SAMPLES; i += 17) {
      expect(azimuthsRad[i]).toBeCloseTo(Math.atan2(positions[i * 3 + 1], positions[i * 3]), 5);
    }
  });

  it('reuses caller-owned buffers, allocating nothing on the resample cadence', () => {
    const outPositions = new Float32Array(DEFAULT_GROUND_TRACK_SAMPLES * 3);
    const outAzimuthsRad = new Float32Array(DEFAULT_GROUND_TRACK_SAMPLES);
    const result = sampleGroundTrack({
      satrec,
      record,
      noradId: '25544',
      atMs: EPOCH_MS,
      outPositions,
      outAzimuthsRad,
    });
    expect(result.positions).toBe(outPositions);
    expect(result.azimuthsRad).toBe(outAzimuthsRad);
  });

  it('refuses a positions buffer too small to hold the track', () => {
    expect(() =>
      sampleGroundTrack({
        satrec,
        record,
        noradId: '25544',
        atMs: EPOCH_MS,
        outPositions: new Float32Array(9),
      }),
    ).toThrow(RangeError);
  });

  it('refuses an azimuths buffer too small to hold the track', () => {
    expect(() =>
      sampleGroundTrack({
        satrec,
        record,
        noradId: '25544',
        atMs: EPOCH_MS,
        outAzimuthsRad: new Float32Array(3),
      }),
    ).toThrow(RangeError);
  });

  it('needs at least two samples to be a line', () => {
    expect(() => sampleGroundTrack({ satrec, record, noradId: '25544', atMs: EPOCH_MS, samples: 1 })).toThrow(
      RangeError,
    );
  });

  // All-or-nothing: half a track drawn without complaint looks like a
  // track that really does stop there.
  it('throws rather than returning a partial track when propagation fails', () => {
    const decayed = issLikeRecord({ MEAN_MOTION: 20.5, BSTAR: 0.9 });
    expect(() =>
      sampleGroundTrack({
        satrec: satrecFromOmm(decayed),
        record: decayed,
        noradId: '99999',
        atMs: EPOCH_MS + 400 * 86_400_000,
      }),
    ).toThrow(GroundTrackError);
  });
});
