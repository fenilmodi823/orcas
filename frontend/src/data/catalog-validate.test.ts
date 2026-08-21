import { describe, expect, it } from 'vitest';
import { classifyRegime, validateRecord } from './catalog-validate.js';
import { ObjType, Regime } from './catalog-types.js';
import type { OmmRecord } from '@orcas/physics';

const NOW_MS = Date.parse('2026-08-22T00:00:00.000Z');

/** A real-shaped, healthy OMM record — ISS-like LEO orbit, epoch just
 * before NOW_MS so it propagates cleanly. Synthetic fixture, not a claim
 * about a real catalogued object (same convention as
 * packages/orcas-physics/test/propagate.test.ts). */
const VALID: OmmRecord = {
  OBJECT_NAME: 'ORCAS-TEST-SAT',
  OBJECT_ID: '1998-999Z',
  EPOCH: '2026-08-21T00:00:00.000000',
  MEAN_MOTION: 15.5,
  ECCENTRICITY: 0.0001,
  INCLINATION: 51.6,
  RA_OF_ASC_NODE: 0,
  ARG_OF_PERICENTER: 0,
  MEAN_ANOMALY: 0,
  EPHEMERIS_TYPE: 0,
  CLASSIFICATION_TYPE: 'U',
  NORAD_CAT_ID: '90001',
  ELEMENT_SET_NO: 999,
  REV_AT_EPOCH: 1,
  BSTAR: 0,
  MEAN_MOTION_DOT: 0,
  MEAN_MOTION_DDOT: 0,
};

describe('classifyRegime', () => {
  it('classifies a ~417 km LEO orbit', () => {
    expect(classifyRegime(15.5, 0.0001)).toBe(Regime.LEO);
  });

  it('classifies a GPS-like MEO orbit', () => {
    expect(classifyRegime(2.0, 0.01)).toBe(Regime.MEO);
  });

  it('classifies a geostationary orbit', () => {
    expect(classifyRegime(1.0027, 0.0002)).toBe(Regime.GEO);
  });

  it('classifies a highly eccentric (Molniya-like) orbit as HEO regardless of altitude', () => {
    expect(classifyRegime(2.0, 0.74)).toBe(Regime.HEO);
  });
});

describe('validateRecord', () => {
  it('accepts a well-formed, propagatable record', () => {
    const result = validateRecord(VALID, NOW_MS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.meta.norad).toBe('90001');
      expect(result.meta.regime).toBe(Regime.LEO);
      expect(result.meta.type).toBe(ObjType.Unknown);
      expect(Object.isFrozen(result.meta)).toBe(true);
      expect(Object.isFrozen(result.meta.record)).toBe(true);
    }
  });

  it('maps a recognised OBJECT_TYPE', () => {
    const result = validateRecord({ ...VALID, OBJECT_TYPE: 'ROCKET BODY' }, NOW_MS);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.meta.type).toBe(ObjType.RocketBody);
  });

  it('rejects a non-object', () => {
    const result = validateRecord('not a record', NOW_MS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.reason).toBe('missing-required-field');
  });

  it('rejects a record missing a required field', () => {
    const rest: Record<string, unknown> = { ...VALID };
    delete rest.NORAD_CAT_ID;
    const result = validateRecord(rest, NOW_MS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.reason).toBe('missing-required-field');
  });

  it('rejects a record with the wrong field type', () => {
    const result = validateRecord({ ...VALID, MEAN_MOTION: '15.5' }, NOW_MS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.reason).toBe('invalid-field-type');
  });

  it('rejects an unparseable EPOCH', () => {
    const result = validateRecord({ ...VALID, EPOCH: 'not-a-date' }, NOW_MS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.reason).toBe('invalid-field-type');
  });

  it('rejects an epoch in the future', () => {
    const result = validateRecord({ ...VALID, EPOCH: '2026-09-01T00:00:00.000000' }, NOW_MS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.reason).toBe('epoch-in-the-future');
  });

  it('rejects a record whose elements cannot be propagated to now (decayed/bad)', () => {
    // Epoch far in the past relative to NOW_MS with a high drag term —
    // by the time NOW_MS arrives, SGP4 reports the object has decayed.
    const decayed: OmmRecord = {
      ...VALID,
      NORAD_CAT_ID: '90002',
      EPOCH: '2020-01-01T00:00:00.000000',
      BSTAR: 0.5,
      MEAN_MOTION: 16.5,
    };
    const result = validateRecord(decayed, NOW_MS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.reason).toBe('propagation-failed');
  });
});
