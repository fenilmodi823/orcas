import { TRAIL_FLOOR } from '../paths/path-geometry.js';

/** Points per orbit line, the first and last both at the planet. NASA draws 360. */
export const ORBIT_SAMPLES = 361;
/** NASA's planet line widths (Reference §4.3); the 2 px hover width arrives with clickable planet labels in S5. */
export const ORBIT_LINE_WIDTH_PX = 1.2;
/** NASA's hover: the line goes to 2 px at full opacity (Reference §4.3). */
export const ORBIT_LINE_HOVER_WIDTH_PX = 2;

/**
 * RGBA per sample for a planet's orbit line, written once: NASA Eyes' orbit
 * line is brightest at the body and falls symmetrically to its far side
 * (Reference §4.3), so it reads as where the planet is on its orbit. The far
 * side keeps the featured paths' floor (`TRAIL_FLOOR`), one ORCAS tunable,
 * since NASA's `farSideAlphaFade` value was not read.
 */
export function writeOrbitColours(rgb: { r: number; g: number; b: number }, colours: Float32Array): void {
  const last = ORBIT_SAMPLES - 1;
  for (let k = 0; k < ORBIT_SAMPLES; k++) {
    const fromBody = (2 * Math.min(k, last - k)) / last; // 0 at the planet, 1 on the far side
    colours[k * 4] = rgb.r;
    colours[k * 4 + 1] = rgb.g;
    colours[k * 4 + 2] = rgb.b;
    colours[k * 4 + 3] = 1 - (1 - TRAIL_FLOOR) * fromBody;
  }
}

/**
 * `out = points + offset`, the sum taken in float64 before the float32 store.
 * With offset = (Sun − camera) and the line's `.position` at the camera, only
 * camera-relative values reach the GPU, so the part of an orbit near the
 * camera keeps its precision at any distance from the Sun (B.21; the same
 * idea as `subtractCameraOffset`). Input/output: km.
 */
export function writeOffsetPositions(
  points: Float64Array,
  count: number,
  offset: { x: number; y: number; z: number },
  out: Float32Array,
): void {
  for (let i = 0; i < count; i++) {
    out[i * 3] = points[i * 3] + offset.x;
    out[i * 3 + 1] = points[i * 3 + 1] + offset.y;
    out[i * 3 + 2] = points[i * 3 + 2] + offset.z;
  }
}
