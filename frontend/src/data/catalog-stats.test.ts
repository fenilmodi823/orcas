import { describe, expect, it } from 'vitest';
import { computeCatalogStats } from './catalog-stats.js';
import { buildSnapshot } from './catalog-snapshot.js';
import type { OmmRecord } from '@orcas/physics';

const NOW_MS = Date.parse('2026-08-22T00:00:00.000Z');
const DAY_MS = 86_400_000;

function fixture(overrides: Partial<OmmRecord> = {}): OmmRecord {
  return {
    OBJECT_NAME: 'ORCAS-TEST-SAT',
    OBJECT_ID: '1998-999Z',
    EPOCH: new Date(NOW_MS - DAY_MS).toISOString(),
    MEAN_MOTION: 15.5, // LEO
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
    ...overrides,
  };
}

describe('computeCatalogStats', () => {
  it('counts objects by regime', () => {
    const snapshot = buildSnapshot(
      [
        fixture({ NORAD_CAT_ID: '1', MEAN_MOTION: 15.5, ECCENTRICITY: 0.0001 }), // LEO
        fixture({ NORAD_CAT_ID: '2', MEAN_MOTION: 2.0, ECCENTRICITY: 0.01 }), // MEO
        fixture({ NORAD_CAT_ID: '3', MEAN_MOTION: 1.0027, ECCENTRICITY: 0.0002 }), // GEO
        fixture({ NORAD_CAT_ID: '4', MEAN_MOTION: 2.0, ECCENTRICITY: 0.74 }), // HEO
      ],
      NOW_MS,
    );
    const stats = computeCatalogStats(snapshot, NOW_MS);
    expect(stats.regimeCounts).toEqual({ leo: 1, meo: 1, geo: 1, heo: 1, unknown: 0 });
    expect(stats.objectCount).toBe(4);
  });

  it('buckets objects by element-set age', () => {
    const snapshot = buildSnapshot(
      [
        fixture({ NORAD_CAT_ID: '1', EPOCH: new Date(NOW_MS - 0.5 * DAY_MS).toISOString() }),
        fixture({ NORAD_CAT_ID: '2', EPOCH: new Date(NOW_MS - 3 * DAY_MS).toISOString() }),
        fixture({ NORAD_CAT_ID: '3', EPOCH: new Date(NOW_MS - 15 * DAY_MS).toISOString() }),
        fixture({ NORAD_CAT_ID: '4', EPOCH: new Date(NOW_MS - 45 * DAY_MS).toISOString() }),
      ],
      NOW_MS,
    );
    const stats = computeCatalogStats(snapshot, NOW_MS);
    expect(stats.epochAgeBuckets).toEqual({
      underOneDay: 1,
      oneToSevenDays: 1,
      sevenToThirtyDays: 1,
      overThirtyDays: 1,
    });
  });

  it('counts rejections by reason', () => {
    const snapshot = buildSnapshot(
      [fixture({ NORAD_CAT_ID: '1' }), { OBJECT_NAME: 'incomplete' }, 'not an object'],
      NOW_MS,
    );
    const stats = computeCatalogStats(snapshot, NOW_MS);
    expect(stats.rejectedCount).toBe(2);
    expect(stats.rejectionCounts['missing-required-field']).toBe(2);
  });
});
