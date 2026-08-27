import { Vector3 } from 'three';

export const R_EARTH_A_KM = 6378.137;
export const R_EARTH_B_KM = 6356.752;

const FREE_ORBIT_MIN_ALT_KM = 120; // atmosphere shell inner boundary / near-plane clipping
const FLIGHT_CLEARANCE_ALT_KM = 200;
const SOFT_REPULSION_BAND_KM = 300;

/** Layer 1 (brief §C.8): in freeOrbit, radius ≥ R_earth + 120 km. */
export function clampFreeOrbitRadiusKm(radiusKm: number): number {
  return Math.max(radiusKm, R_EARTH_A_KM + FREE_ORBIT_MIN_ALT_KM);
}

/**
 * Ellipsoid test in scaled space (brief §C.8): divide (x, y, z) by
 * (a, a, b) and it becomes a unit-sphere test. One division per axis,
 * exact. `> 1` outside the ellipsoid, `< 1` penetrating.
 */
export function ellipsoidNormalizedDistance(posKm: Vector3): number {
  const x = posKm.x / R_EARTH_A_KM;
  const y = posKm.y / R_EARTH_A_KM;
  const z = posKm.z / R_EARTH_B_KM;
  return Math.sqrt(x * x + y * y + z * z);
}

/**
 * Layer 3 (brief §C.8): only needed when BOTH camera endpoints sit low
 * over the planet — flying from a very-low-LEO framing to another on the
 * far side. `camDist0Km` / `camDist1Km` are the camera positions' distances
 * from Earth's centre at the two endpoints. Grow the arc swell so the
 * path's minimum radius clears R_earth + 200 km: the camera arcs up over
 * the limb and back down, which is how you would actually shoot it and
 * makes the Earth's curvature legible during the move.
 *
 *   A = max(A, r_min_required / min(camDist0, camDist1) − 1)
 *
 * For the common Earth-view → satellite flight, both endpoints clear
 * comfortably and this returns 0.
 */
export function requiredExtraSwellGain(camDist0Km: number, camDist1Km: number): number {
  const rMinRequired = R_EARTH_A_KM + FLIGHT_CLEARANCE_ALT_KM;
  const rPathMin = Math.min(camDist0Km, camDist1Km);
  if (rPathMin >= rMinRequired) return 0;
  return rMinRequired / rPathMin - 1;
}

/**
 * Soft repulsion for manual zoom (brief §C.8): rather than hard-clamping
 * `radius` when the user drags toward the surface (which feels like hitting
 * a wall), scale the zoom-in delta down as it enters the last 300 km. The
 * user feels the camera getting heavy. Returns 0..1 — multiply the
 * intended inward radius change by it.
 *
 * The brief's `1/(r − r_min)` is the sharper alternative; a bounded ramp is
 * gentler and cannot blow up. Tune in Task 15.
 */
export function softRepulsionScale(radiusKm: number, rMinKm: number): number {
  const over = radiusKm - rMinKm;
  if (over >= SOFT_REPULSION_BAND_KM) return 1;
  if (over <= 0) return 0;
  return over / SOFT_REPULSION_BAND_KM;
}
