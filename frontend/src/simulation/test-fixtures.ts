import type { SatRec } from 'satellite.js';
import { satrecFromOmm } from '@orcas/physics';
import type { OmmRecord } from '@orcas/physics';
import { Regime, ObjType, type ObjectMeta } from '../data/catalog-types.js';

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

/** A synthetic, deterministic LEO catalogue for simulation-core tests —
 * not real data, so it never touches the network or IndexedDB. */
export function makeTestCatalog(count: number): { objects: ObjectMeta[]; satrecs: Map<string, SatRec> } {
  const norads = Array.from({ length: count }, (_, i) => `90${String(i).padStart(4, '0')}`);
  const records = new Map(norads.map((n) => [n, omm(n)]));
  const objects = norads.map((n) => objectMeta(n, records.get(n)!));
  const satrecs = new Map(norads.map((n) => [n, satrecFromOmm(records.get(n)!)]));
  return { objects, satrecs };
}
