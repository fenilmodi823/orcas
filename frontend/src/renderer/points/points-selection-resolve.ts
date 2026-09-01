import type { NoradId, ObjectMeta } from '../../data/catalog-types.js';
import type { SelectableObject } from '../../state/selection-store.js';
import type { ObjectDetailData } from '../../ui/ObjectDetail.js';
import { classifyOrbitClass } from './points-filters.js';

// Sphere approximation, not the WGS84 ellipsoid — this is a UI readout,
// not a physics computation, and matches PropagationDebug.tsx's own
// altitudeKm helper exactly. Magnitude is rotation-invariant, so this is
// correct regardless of whether `positions` is TEME or J2000 — the two
// frames differ only by a rotation, which never changes a vector's length.
const EARTH_RADIUS_KM = 6371;

/**
 * Builds the exact prop shape ObjectSummary/ObjectTether already expect
 * from a NORAD id plus the live catalogue and FrameState. Null if the
 * id isn't in the current snapshot (brief §D.4: "if the object has left
 * the catalogue... clear the selection explicitly and say so").
 * `classifyOrbitClass` can return null for a non-debris, unknown-regime
 * object (M1.4) — SelectableObject.orbitClass is non-nullable, so this
 * falls back to 'debris' for DISPLAY colour only; that fallback has no
 * bearing on M1.4's filter-visibility rule for the same object.
 */
export function resolveSelectableObject(
  norad: NoradId,
  objects: readonly ObjectMeta[],
  byNorad: Readonly<Record<string, number>>,
  frameState: { positions: Float32Array; velocities: Float32Array },
): SelectableObject | null {
  const index = byNorad[norad];
  if (index === undefined) return null;
  const object = objects[index];
  if (!object) return null;

  const positionKm = {
    x: frameState.positions[index * 3],
    y: frameState.positions[index * 3 + 1],
    z: frameState.positions[index * 3 + 2],
  };
  const velocityKmS = {
    x: frameState.velocities[index * 3],
    y: frameState.velocities[index * 3 + 1],
    z: frameState.velocities[index * 3 + 2],
  };

  return {
    id: object.norad,
    name: object.name,
    noradId: object.norad,
    orbitClass: classifyOrbitClass(object) ?? 'debris',
    altitudeKm: Math.hypot(positionKm.x, positionKm.y, positionKm.z) - EARTH_RADIUS_KM,
    velocityKmS: Math.hypot(velocityKmS.x, velocityKmS.y, velocityKmS.z),
    inclinationDeg: object.record.INCLINATION,
  };
}

/**
 * The Keplerian elements ObjectDetail's grid shows are already stored
 * verbatim on the canonical OMM record — no computation needed.
 * mahalanobisDistance/probabilityOfCollision stay undefined: conjunction
 * screening doesn't exist in this codebase yet (Phase 5).
 *
 * The epoch comes from `epochMs`, which catalog-validate.ts already
 * produced with `Date.parse` and rejected the record over if unparseable —
 * so it cannot be NaN here. Re-parsing `record.EPOCH` instead is what
 * shipped, and it crashed the whole route: the backend emits ISO offsets
 * (`…+00:00`), the parser appended a `Z` to anything not already ending in
 * one, and `…+00:00Z` is an Invalid Date whose `toISOString()` throws
 * inside StatusPill. Never re-derive a value the validated layer already
 * carries.
 */
export function resolveObjectDetail(object: ObjectMeta): ObjectDetailData {
  return {
    eccentricity: object.record.ECCENTRICITY,
    raanDeg: object.record.RA_OF_ASC_NODE,
    argPericenterDeg: object.record.ARG_OF_PERICENTER,
    meanAnomalyDeg: object.record.MEAN_ANOMALY,
    epoch: new Date(object.epochMs),
  };
}
