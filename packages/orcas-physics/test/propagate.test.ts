import { describe, expect, it } from 'vitest';
import { satrecFromOmm, propagate, gmstRad, eciToGeodeticDeg } from '../src/index.js';
import type { OmmRecord } from '../src/index.js';

/**
 * Synthetic test fixture — NOT a real catalogued object. A near-circular
 * ~417 km LEO orbit at 51.6 deg inclination, epoch fixed at 2026-01-01T00:00Z.
 * Expected values below were computed by actually running satellite.js
 * against this fixture (not hand-derived), so this is a regression guard:
 * it fails if the propagation chain breaks, not a claim about a real object.
 */
const TEST_OMM: OmmRecord = {
  OBJECT_NAME: 'ORCAS-TEST-SAT',
  OBJECT_ID: '1998-999Z',
  EPOCH: '2026-01-01T00:00:00.000000',
  MEAN_MOTION: 15.5,
  ECCENTRICITY: 0.0001,
  INCLINATION: 51.6,
  RA_OF_ASC_NODE: 0,
  ARG_OF_PERICENTER: 0,
  MEAN_ANOMALY: 0,
  EPHEMERIS_TYPE: 0,
  CLASSIFICATION_TYPE: 'U',
  NORAD_CAT_ID: '900001',
  ELEMENT_SET_NO: 999,
  REV_AT_EPOCH: 1,
  BSTAR: 0,
  MEAN_MOTION_DOT: 0,
  MEAN_MOTION_DDOT: 0,
};

const AT = new Date('2026-01-01T00:00:00.000Z');

describe('propagate — known-position regression', () => {
  it('reproduces the recorded ECI position and velocity at epoch', () => {
    const satrec = satrecFromOmm(TEST_OMM);
    const state = propagate(satrec, AT, TEST_OMM.NORAD_CAT_ID);

    expect(state.positionEciKm.x).toBeCloseTo(6794.92, 1);
    expect(state.positionEciKm.y).toBeCloseTo(-7.28, 1);
    expect(state.positionEciKm.z).toBeCloseTo(-9.18, 1);

    expect(state.velocityEciKmS.x).toBeCloseTo(0.0066, 2);
    expect(state.velocityEciKmS.y).toBeCloseTo(4.7576, 2);
    expect(state.velocityEciKmS.z).toBeCloseTo(6.0069, 2);
  });

  it('rotates to a geodetic position consistent with a ~417 km circular orbit', () => {
    const satrec = satrecFromOmm(TEST_OMM);
    const state = propagate(satrec, AT, TEST_OMM.NORAD_CAT_ID);
    const gmst = gmstRad(AT);
    const geo = eciToGeodeticDeg(state.positionEciKm, gmst);

    expect(geo.altitudeKm).toBeCloseTo(416.79, 1);
    expect(geo.latitudeDeg).toBeCloseTo(-0.078, 2);
    expect(geo.longitudeDeg).toBeCloseTo(-100.72, 1);
  });

  it('is deterministic — same input, same output', () => {
    const satrec = satrecFromOmm(TEST_OMM);
    const first = propagate(satrec, AT, TEST_OMM.NORAD_CAT_ID);
    const second = propagate(satrec, AT, TEST_OMM.NORAD_CAT_ID);
    expect(second.positionEciKm).toEqual(first.positionEciKm);
  });
});
