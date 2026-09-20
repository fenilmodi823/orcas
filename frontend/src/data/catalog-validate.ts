import { propagate, satrecFromOmm } from '@orcas/physics';
import type { OmmRecord } from '@orcas/physics';
import { ObjType, OrbitClass } from './catalog-types.js';
import type { NoradId, ObjectMeta, RejectedRecord } from './catalog-types.js';

const REQUIRED_FIELDS = [
  'OBJECT_NAME',
  'OBJECT_ID',
  'EPOCH',
  'MEAN_MOTION',
  'ECCENTRICITY',
  'INCLINATION',
  'NORAD_CAT_ID',
] as const;

const OBJECT_TYPE_MAP: Readonly<Record<string, ObjType>> = {
  PAYLOAD: ObjType.Payload,
  'ROCKET BODY': ObjType.RocketBody,
  DEBRIS: ObjType.Debris,
};

const EARTH_MU_KM3_S2 = 398600.4418; // standard gravitational parameter, Earth
const EARTH_RADIUS_KM = 6378.137; // WGS-84 equatorial radius

/**
 * How far ahead of "now" an element-set epoch may legitimately sit.
 *
 * A future epoch is not invalid data. Space-Track's `gp` class publishes
 * epochs ahead of the current time for some deep-space objects — measured on
 * the live catalogue 2026-09-20, TESS (43435), both VELA satellites (837,
 * 1458) and a YZ-1 rocket body (41929) were all up to about 23 hours ahead —
 * and SGP4 propagates backwards from an epoch perfectly well. Rejecting every
 * future epoch silently dropped those four real objects from the scene.
 *
 * ponytail: a flat 7-day window, an order of magnitude above the ~23 h
 * actually observed, which still catches the wrong-year parse errors this
 * check was written for. Narrow it if a real object ever needs less.
 */
const MAX_EPOCH_LOOKAHEAD_DAYS = 7;
const MAX_EPOCH_LOOKAHEAD_MS = MAX_EPOCH_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000;

/**
 * Rough LEO/MEO/GEO/HEO classification from mean motion and eccentricity.
 * ponytail: altitude/eccentricity bands, not the authoritative ESA/NASA/ITU
 * classification — the Phase-4 brief's own gap G4 found no agreed
 * thresholds between standards bodies on the precise boundaries. Good
 * enough for a debug histogram; revisit properly when
 * backend/app/domain/orbit_classes.py is actually built.
 *
 * Named distinctly from `points-filters.ts`'s `classifyOrbitClass`: that
 * one maps an already-built `ObjectMeta` to the 5-way UI `FilterClass`
 * (debris takes precedence); this one derives the raw `OrbitClass` enum
 * value from orbital elements, before an `ObjectMeta` exists.
 */
export function deriveOrbitClass(meanMotionRevDay: number, eccentricity: number): OrbitClass {
  if (eccentricity > 0.25) return OrbitClass.HEO;
  const meanMotionRadS = (meanMotionRevDay * 2 * Math.PI) / 86400;
  if (meanMotionRadS <= 0) return OrbitClass.Unknown;
  const semiMajorAxisKm = Math.cbrt(EARTH_MU_KM3_S2 / (meanMotionRadS * meanMotionRadS));
  const altitudeKm = semiMajorAxisKm - EARTH_RADIUS_KM;
  if (altitudeKm < 2000) return OrbitClass.LEO;
  if (altitudeKm < 35286) return OrbitClass.MEO;
  return OrbitClass.GEO;
}

interface ValidationSuccess {
  readonly ok: true;
  readonly meta: ObjectMeta;
}
interface ValidationFailure {
  readonly ok: false;
  readonly rejection: RejectedRecord;
}
export type ValidationResult = ValidationSuccess | ValidationFailure;

function reject(reason: RejectedRecord['reason'], detail: string, raw: unknown): ValidationFailure {
  return { ok: false, rejection: { reason, detail, raw } };
}

/**
 * Validate one raw record (already-parsed JSON) as a canonical OMM
 * catalogue entry. Does not check for duplicates across a batch — see
 * buildSnapshot in catalog-snapshot.ts, which owns that check because it
 * requires seeing the whole batch.
 *
 * Propagates to `nowMs` (not the record's own epoch) as the final check —
 * this is deliberate: it is what actually catches a decayed object, per
 * the Phase-4 brief's M0.3 finding that SGP4 error codes only surface
 * once you propagate far enough past epoch, not at epoch itself.
 */
export function validateRecord(raw: unknown, nowMs: number): ValidationResult {
  if (typeof raw !== 'object' || raw === null) {
    return reject('missing-required-field', 'record is not an object', raw);
  }
  const rec = raw as Record<string, unknown>;

  for (const field of REQUIRED_FIELDS) {
    if (rec[field] === undefined || rec[field] === null || rec[field] === '') {
      return reject('missing-required-field', `missing ${field}`, raw);
    }
  }
  if (
    typeof rec.NORAD_CAT_ID !== 'string' ||
    typeof rec.MEAN_MOTION !== 'number' ||
    typeof rec.ECCENTRICITY !== 'number' ||
    typeof rec.EPOCH !== 'string'
  ) {
    return reject('invalid-field-type', 'a numeric/string field has the wrong type', raw);
  }

  const epochMs = Date.parse(rec.EPOCH);
  if (Number.isNaN(epochMs)) {
    return reject('invalid-field-type', 'EPOCH is not a parseable date', raw);
  }
  if (epochMs > nowMs + MAX_EPOCH_LOOKAHEAD_MS) {
    return reject(
      'epoch-implausibly-far-ahead',
      `epoch ${rec.EPOCH} is more than ${MAX_EPOCH_LOOKAHEAD_DAYS} days after now`,
      raw,
    );
  }

  const record = Object.freeze({ ...raw }) as OmmRecord;
  try {
    const satrec = satrecFromOmm(record);
    propagate(satrec, new Date(nowMs), record.NORAD_CAT_ID);
  } catch {
    return reject(
      'propagation-failed',
      `SGP4 cannot propagate ${record.NORAD_CAT_ID} to now — decayed or unusable elements`,
      raw,
    );
  }

  const objectTypeRaw = typeof rec.OBJECT_TYPE === 'string' ? rec.OBJECT_TYPE.toUpperCase() : null;
  const sourceTypeRaw = typeof rec.SOURCE_TYPE === 'string' ? rec.SOURCE_TYPE : 'unknown';

  return {
    ok: true,
    meta: Object.freeze({
      norad: record.NORAD_CAT_ID as NoradId,
      name: record.OBJECT_NAME,
      objectId: record.OBJECT_ID,
      type: objectTypeRaw ? (OBJECT_TYPE_MAP[objectTypeRaw] ?? ObjType.Unknown) : ObjType.Unknown,
      orbitClass: deriveOrbitClass(record.MEAN_MOTION, record.ECCENTRICITY),
      isActive: typeof rec.IS_ACTIVE === 'boolean' ? rec.IS_ACTIVE : false,
      sourceType: sourceTypeRaw,
      source: typeof rec.SOURCE === 'string' ? rec.SOURCE : 'unknown',
      epochMs,
      record,
    }),
  };
}
