import { describe, expect, it } from 'vitest';
import { satrecFromOmm } from '@orcas/physics';
import type { OmmRecord } from '@orcas/physics';
import { createPropagationPool, createInProcessRunner } from './worker-pool.js';
import type { ObjectMeta } from '../data/catalog-types.js';
import { Regime, ObjType } from '../data/catalog-types.js';

function objectMeta(norad: string, record: OmmRecord): ObjectMeta {
  return {
    norad: norad as ObjectMeta['norad'],
    name: record.OBJECT_NAME,
    objectId: record.OBJECT_ID,
    type: ObjType.Payload,
    regime: Regime.LEO,
    isActive: true,
    sourceType: 'real',
    epochMs: Date.parse('2026-01-01T00:00:00.000Z'),
    record,
  };
}

function omm(norad: string): OmmRecord {
  return {
    OBJECT_NAME: `SAT-${norad}`,
    OBJECT_ID: '2026-999A',
    EPOCH: '2026-01-01T00:00:00.000000',
    MEAN_MOTION: 15.5,
    ECCENTRICITY: 0.001,
    INCLINATION: 51.6,
    RA_OF_ASC_NODE: 0,
    ARG_OF_PERICENTER: 0,
    MEAN_ANOMALY: 0,
    EPHEMERIS_TYPE: 0,
    CLASSIFICATION_TYPE: 'U',
    NORAD_CAT_ID: norad,
    ELEMENT_SET_NO: 999,
    REV_AT_EPOCH: 1,
    BSTAR: 0,
    MEAN_MOTION_DOT: 0,
    MEAN_MOTION_DDOT: 0,
  };
}

const NORADS = Array.from({ length: 10 }, (_, i) => `90${String(i).padStart(4, '0')}`);
const RECORDS = new Map(NORADS.map((n) => [n, omm(n)]));
const OBJECTS = NORADS.map((n) => objectMeta(n, RECORDS.get(n)!));
const SATRECS = new Map(NORADS.map((n) => [n, satrecFromOmm(RECORDS.get(n)!)]));

const T0_MS = Date.parse('2026-01-01T00:00:00.000Z');
const T1_MS = T0_MS + 30_000;

describe('createPropagationPool', () => {
  it('reassembles results in the original object order regardless of shard count', async () => {
    const pool1 = createPropagationPool([createInProcessRunner(SATRECS)]);
    const pool4 = createPropagationPool([
      createInProcessRunner(SATRECS),
      createInProcessRunner(SATRECS),
      createInProcessRunner(SATRECS),
      createInProcessRunner(SATRECS),
    ]);

    const result1 = await pool1.buildSegments(OBJECTS, T0_MS, T1_MS);
    const result4 = await pool4.buildSegments(OBJECTS, T0_MS, T1_MS);

    expect(result1.map((s) => s.noradId)).toEqual(NORADS);
    expect(result4.map((s) => s.noradId)).toEqual(NORADS);
  });

  it('is deterministic across different pool sizes — bit-identical segments', async () => {
    const pool1 = createPropagationPool([createInProcessRunner(SATRECS)]);
    const pool4 = createPropagationPool(Array.from({ length: 4 }, () => createInProcessRunner(SATRECS)));

    const result1 = await pool1.buildSegments(OBJECTS, T0_MS, T1_MS);
    const result4 = await pool4.buildSegments(OBJECTS, T0_MS, T1_MS);

    expect(result4).toEqual(result1);
  });

  it('throws if constructed with zero runners', () => {
    expect(() => createPropagationPool([])).toThrow();
  });
});
