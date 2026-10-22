import { Vector3 } from 'three';

/**
 * NASA's minimum System-view distances, km (NASA Eyes `_customSystemDistances`, app.js, read 2026-10-12), copied
 * as distances, as S5a copied home's 7 × 10⁸ km.
 */
export const SYSTEM_MIN_DISTANCE_KM: Readonly<Record<string, number>> = {
  mercury: 425_648,
  venus: 862_136,
  earth: 1_040_264,
  mars: 80_000,
  jupiter: 7_157_638,
  saturn: 4_869_142,
  uranus: 1_886_367,
  neptune: 2_407_045,
};
/** NASA's "Outer" view of the Solar System: the Sun from 10¹⁰ km, 25° above the Earth's orbit plane. */
export const OUTER_SYSTEM_DISTANCE_KM = 1e10;
/** NASA looks down on a system's plane from 25° (`_goToSystem`'s default angle). */
export const SYSTEM_ELEVATION_DEG = 25;
/** NASA frames the fitted system × 1.3, as it does a body on arrival (Reference §4.5). */
const FIT_SCALE = 1.3;
const DEG = Math.PI / 180;

/** Something a System view must fit: an offset from the system's body, km, and a radius, km. */
export interface SystemMember {
  readonly offsetKm: Vector3;
  readonly radiusKm: number;
}

export interface SystemViewInput {
  /** The camera's offset from the system's body now, km. */
  readonly cameraOffsetKm: Vector3;
  /** The plane's normal, unit: the planet's pole, or for the Earth the Moon's orbit normal. */
  readonly planeNormal: Vector3;
  readonly members: readonly SystemMember[];
  readonly fovVerticalDeg: number;
  /** Width over height. */
  readonly aspect: number;
  readonly minDistanceKm: number;
}

const _m = new Vector3();
const _p = new Vector3();
const _up = new Vector3();
const _right = new Vector3();

/**
 * NASA Eyes' System view (S6b, `_goToSystem`): the camera keeps its bearing around the plane's normal, rises 25°
 * above the plane, and backs off until every member fits, × 1.3, never nearer than NASA's minimum. NASA's fit
 * per member is |lateral| / tan(half-FOV) + radius / sin(half-FOV), horizontally and vertically, less its depth
 * offset; ORCAS adds a member's offset toward the camera instead, which only differs for a member in front, and
 * for moons in the plane seen from 25° the horizontal term sets the distance. Output: the camera's offset from
 * the system's body, km, into `out`.
 */
export function systemViewOffsetKm(input: SystemViewInput, out: Vector3): Vector3 {
  const m = _m.copy(input.planeNormal).normalize();
  const p = _p.copy(input.cameraOffsetKm).addScaledVector(m, -input.cameraOffsetKm.dot(m));
  if (p.lengthSq() < 1e-12) {
    // Straight over the pole: any bearing in the plane will do.
    p.set(1, 0, 0).addScaledVector(m, -m.x);
    if (p.lengthSq() < 1e-12) p.set(0, 1, 0).addScaledVector(m, -m.y);
  }
  p.normalize();
  const dir = out.copy(p).multiplyScalar(Math.cos(SYSTEM_ELEVATION_DEG * DEG)).addScaledVector(m, Math.sin(SYSTEM_ELEVATION_DEG * DEG));
  const up = _up.copy(m).addScaledVector(dir, -m.dot(dir)).normalize();
  const right = _right.crossVectors(up, dir);
  const tanV = Math.tan((input.fovVerticalDeg * DEG) / 2);
  const sinV = Math.sin((input.fovVerticalDeg * DEG) / 2);
  const tanH = tanV * input.aspect;
  const sinH = Math.sin(Math.atan(tanH));
  let fitKm = 0;
  for (const { offsetKm, radiusKm } of input.members) {
    const toward = offsetKm.dot(dir);
    fitKm = Math.max(
      fitKm,
      toward + Math.abs(offsetKm.dot(right)) / tanH + radiusKm / sinH,
      toward + Math.abs(offsetKm.dot(up)) / tanV + radiusKm / sinV,
    );
  }
  return dir.multiplyScalar(Math.max(input.minDistanceKm, fitKm * FIT_SCALE));
}
