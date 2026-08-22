import { json2satrec, type SatRec } from 'satellite.js';
import type { OmmRecord } from './types.js';

/**
 * satellite.js's json2satrec appends 'Z' whenever EPOCH doesn't already
 * end with 'Z' (satellite.js dist/io.js: `jsonobj.EPOCH.endsWith('Z') ?
 * jsonobj.EPOCH : `${jsonobj.EPOCH}Z``) — it has no awareness of an
 * explicit numeric UTC offset. CelesTrak's real GP JSON feed emits EPOCH
 * with a "+00:00" suffix (confirmed live via the backend's own ingested
 * data, e.g. "2026-08-13T20:35:52.287648+00:00"), which every synthetic
 * test fixture in this repo omits — so `"...+00:00" + "Z"` becomes the
 * malformed "...+00:00Z", `new Date(...)` returns Invalid Date, and the
 * satrec's epoch (and therefore every propagated position) is silently
 * NaN. Not a hypothetical: found live-verifying M1.1's debug route
 * against the real ISS record, which reproduced exactly this. Strip a
 * trailing numeric UTC offset before satellite.js ever sees it, so this
 * is fixed once for every caller rather than in each one.
 */
function normalizeEpochToZ(epoch: string): string {
  if (epoch.endsWith('Z')) return epoch;
  // OMM EPOCH is defined by CCSDS to always be UTC, so any explicit
  // numeric offset here is a zero offset spelled differently — safe to
  // replace with 'Z' outright rather than parsing and re-checking it.
  return epoch.replace(/[+-]\d{2}:?\d{2}$/, 'Z');
}

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
    EPOCH: normalizeEpochToZ(record.EPOCH),
    EPHEMERIS_TYPE: record.EPHEMERIS_TYPE === 0 ? 0 : undefined,
    CLASSIFICATION_TYPE:
      record.CLASSIFICATION_TYPE === 'U' || record.CLASSIFICATION_TYPE === 'C'
        ? record.CLASSIFICATION_TYPE
        : undefined,
  });
}
