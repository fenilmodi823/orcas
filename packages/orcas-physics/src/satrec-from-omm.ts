import { json2satrec, type SatRec } from 'satellite.js';
import type { OmmRecord } from './types.js';

/**
 * Build an SGP4 propagator from a canonical OMM record.
 * Input: CelesTrak GP JSON fields (deg, rev/day). Output: initialised SatRec.
 * See ORCAS Vault/01 - Product/Data-Strategy.md §9.4.
 */
export function satrecFromOmm(record: OmmRecord): SatRec {
  // OmmRecord models the real CCSDS/CelesTrak wire types (EPHEMERIS_TYPE:
  // number, CLASSIFICATION_TYPE: string) — never let a library's parser
  // dictate our schema. satellite.js's own types are narrower than the wire
  // format allows, so narrow only here, at the adapter boundary.
  return json2satrec({
    ...record,
    EPHEMERIS_TYPE: record.EPHEMERIS_TYPE === 0 ? 0 : undefined,
    CLASSIFICATION_TYPE:
      record.CLASSIFICATION_TYPE === 'U' || record.CLASSIFICATION_TYPE === 'C'
        ? record.CLASSIFICATION_TYPE
        : undefined,
  });
}
