import { describe, expect, it } from 'vitest';
import { satrecFromOmm } from '../src/index.js';
import type { OmmRecord } from '../src/index.js';

/**
 * satellite.js's json2satrec has no catalog-number ceiling and never
 * re-encodes NORAD_CAT_ID — satrec.satnum is the input string, verbatim,
 * for every case python-sgp4 can (25544, 148493, 339999) and cannot
 * (340000, 799500000, 999999999) construct a Satrec for. ORCAS Vault
 * Phase-4 Engineering Brief, Part 4.2, milestone M0.1. This is a
 * regression guard: if a future satellite.js release starts normalising
 * or rejecting these, ORCAS's identity assumptions break silently
 * without this test.
 */
const BASE: OmmRecord = {
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
  NORAD_CAT_ID: '90001',
  ELEMENT_SET_NO: 999,
  REV_AT_EPOCH: 1,
  BSTAR: 0,
  MEAN_MOTION_DOT: 0,
  MEAN_MOTION_DDOT: 0,
};

describe('catalog identity — no ceiling, no re-encoding', () => {
  it.each(['25544', '148493', '339999', '340000', '799500000', '999999999'])(
    'json2satrec accepts NORAD_CAT_ID=%s and preserves it verbatim on satrec.satnum',
    (noradId) => {
      const record = { ...BASE, NORAD_CAT_ID: noradId };
      const satrec = satrecFromOmm(record);
      expect(satrec.satnum).toBe(noradId);
    },
  );
});
