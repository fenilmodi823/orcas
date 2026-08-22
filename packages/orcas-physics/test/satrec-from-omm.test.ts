import { describe, expect, it } from 'vitest';
import { satrecFromOmm, propagate } from '../src/index.js';
import type { OmmRecord } from '../src/index.js';

/**
 * Real ISS (ZARYA) elements, as actually returned by the backend's own
 * CelesTrak-sourced OMM snapshot — not a synthetic fixture. Found via
 * M1.1's live browser verification: every synthetic OmmRecord fixture
 * elsewhere in this repo uses an EPOCH with no timezone suffix
 * ("...000000"), which satellite.js's json2satrec happens to handle
 * correctly by appending 'Z'. CelesTrak's real feed emits an explicit
 * "+00:00" offset instead, which satellite.js's naive
 * `endsWith('Z') ? epoch : epoch + 'Z'` check does not recognise —
 * producing the malformed "...+00:00Z", an Invalid Date, and silent NaN
 * position/velocity through the entire chain, undetected until now
 * because nothing in this repo had propagated a real OMM record before.
 */
const REAL_ISS_OMM: OmmRecord = {
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
};

describe('satrecFromOmm — EPOCH with an explicit UTC offset', () => {
  it('produces a satrec that propagates to a finite position, not NaN', () => {
    const satrec = satrecFromOmm(REAL_ISS_OMM);
    const state = propagate(satrec, new Date('2026-08-22T14:51:40.072Z'), '25544');

    expect(Number.isFinite(state.positionEciKm.x)).toBe(true);
    expect(Number.isFinite(state.positionEciKm.y)).toBe(true);
    expect(Number.isFinite(state.positionEciKm.z)).toBe(true);
    expect(Number.isFinite(state.velocityEciKmS.x)).toBe(true);

    // Sanity range: LEO altitude is a few hundred km above Earth's
    // ~6371km mean radius, so |position| should sit well under 7000km —
    // this fails loudly (not just "not NaN") if the epoch fix ever
    // regresses into some other silently-wrong-but-finite value.
    const radiusKm = Math.hypot(state.positionEciKm.x, state.positionEciKm.y, state.positionEciKm.z);
    expect(radiusKm).toBeGreaterThan(6600);
    expect(radiusKm).toBeLessThan(7000);
  });

  it('produces the same satrec epoch whether EPOCH ends in Z or +00:00', () => {
    const withOffset = satrecFromOmm(REAL_ISS_OMM);
    const withZ = satrecFromOmm({ ...REAL_ISS_OMM, EPOCH: '2026-08-13T20:35:52.287648Z' });
    expect(withOffset.jdsatepoch).toBe(withZ.jdsatepoch);
  });
});
