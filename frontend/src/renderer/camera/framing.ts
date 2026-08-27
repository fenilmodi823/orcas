import { clamp } from './easing.js';

const FRAMING_K = 2.6; // fills ~38% of frame height (brief §C.6)
const CLAMP_LO_MULT = 1.8;
const CLAMP_HI_MULT = 400;

/**
 * How far from a target the camera should sit to frame it (brief §C.6):
 *
 *     r_frame = k · R_extents / tan(fov_v / 2)
 *
 * Uses the bounding-sphere `extentsRadius`, not the occlusion radius — the
 * same distinction NASA draws. Clamped to [R·1.8, R·400] so a degenerate
 * size never sends the camera inside the object or to the next county.
 */
export function framingDistanceKm(extentsRadiusKm: number, fovDeg: number, k = FRAMING_K): number {
  const fovVRad = (fovDeg * Math.PI) / 180;
  const raw = (k * extentsRadiusKm) / Math.tan(fovVRad / 2);
  return clamp(raw, extentsRadiusKm * CLAMP_LO_MULT, extentsRadiusKm * CLAMP_HI_MULT);
}
