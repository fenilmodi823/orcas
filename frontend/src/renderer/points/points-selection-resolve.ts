import { eciToGeodeticDeg } from '@orcas/physics';
import type { NoradId, ObjectMeta } from '../../data/catalog-types.js';
import type { SelectableObject } from '../../state/selection-store.js';
import { classifyOrbitClass } from './points-filters.js';

// Altitude above the WGS84 ellipsoid, the same figure the info panel shows.
// It used to be |r| - 6371 km, a spherical Earth, which over-reports by
// ~7 km at the equator (equatorial radius 6378.137 km) and under-reports
// toward the poles - and put two different altitudes for one object on
// screen once the panel moved to WGS84. Altitude does not depend on GMST, so
// 0 is passed. The frame state is J2000 rather than TEME; the ~0.36 deg of
// precession since 2000 moves the ellipsoid height by at most ~0.13 km,
// well inside the readout's 0.1 km display step for most latitudes.
const GMST_IRRELEVANT_FOR_ALTITUDE = 0;

/**
 * Builds the exact prop shape ObjectSummary/ObjectTether already expect
 * from a NORAD id plus the live catalogue and FrameState. Null if the
 * id isn't in the current snapshot (brief §D.4: "if the object has left
 * the catalogue... clear the selection explicitly and say so").
 * `classifyOrbitClass` can return null for a non-debris, unknown-orbit-class
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
  // A slot the loop has never written is all zeros (createFrameState), and
  // nothing in orbit sits at the Earth's centre. Report "no position yet"
  // rather than the -6356.8 km that zeros turn into.
  if (positionKm.x === 0 && positionKm.y === 0 && positionKm.z === 0) return null;
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
    altitudeKm: eciToGeodeticDeg(positionKm, GMST_IRRELEVANT_FOR_ALTITUDE).altitudeKm,
    velocityKmS: Math.hypot(velocityKmS.x, velocityKmS.y, velocityKmS.z),
    inclinationDeg: object.record.INCLINATION,
  };
}
