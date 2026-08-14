import { json2satrec, type SatRec } from 'satellite.js';
import type { OmmRecord } from './types.js';

/**
 * Build an SGP4 propagator from a canonical OMM record.
 * Input: CelesTrak GP JSON fields (deg, rev/day). Output: initialised SatRec.
 * See ORCAS Vault/01 - Product/Data-Strategy.md §9.4.
 */
export function satrecFromOmm(record: OmmRecord): SatRec {
  return json2satrec(record);
}
