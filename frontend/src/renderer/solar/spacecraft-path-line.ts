// frontend/src/renderer/solar/spacecraft-path-line.ts
import type { InterleavedBufferAttribute } from 'three';
import type { Line2, LineGeometry } from 'three-stdlib';
import { createFatLine } from './orbit-line.js';
import { writeSegmentAlpha } from './segment-alpha.js';
import { MISSION_PATH_MAX_POINTS } from './spacecraft-path.js';

/**
 * `points + offset` straight into a fat line's segment buffer, the sum in float64 before the float32 store
 * (B.21), with no per-segment allocation. Input: km (3 per point); output: km, camera-relative.
 */
export function writeOffsetSegments(
  geometry: LineGeometry,
  points: Float64Array,
  count: number,
  offset: { x: number; y: number; z: number },
): void {
  const data = (geometry.getAttribute('instanceStart') as InterleavedBufferAttribute).data;
  const out = data.array as Float32Array;
  for (let i = 0; i < count - 1; i++) {
    for (let k = 0; k < 2; k++) {
      const p = (i + k) * 3;
      out[i * 6 + k * 3] = (points[p] ?? 0) + offset.x;
      out[i * 6 + k * 3 + 1] = (points[p + 1] ?? 0) + offset.y;
      out[i * 6 + k * 3 + 2] = (points[p + 2] ?? 0) + offset.z;
    }
  }
  data.needsUpdate = true;
}

const PATH_ALPHA = 0.7;
const flat = (): number => PATH_ALPHA;

/**
 * The selected spacecraft's whole path: one untapered fat line of `MISSION_PATH_MAX_POINTS`, flat alpha, rebuilt
 * only when `rebuild` is called, its segments repositioned every frame by `place`.
 */
export function createPathLine(colour: { r: number; g: number; b: number }, widthPx: number) {
  const colours = new Float32Array(MISSION_PATH_MAX_POINTS * 4);
  for (let i = 0; i < MISSION_PATH_MAX_POINTS; i++) colours.set([colour.r, colour.g, colour.b, 1], i * 4);
  const line: Line2 = createFatLine(MISSION_PATH_MAX_POINTS, colours, 1, widthPx);
  line.visible = false;
  return {
    line,
    /** New kinds in, so the dashes and breaks follow; `count` points. */
    rebuild(kinds: Uint8Array, count: number): void {
      writeSegmentAlpha(line.geometry, kinds, count, flat);
    },
    place(points: Float64Array, count: number, offset: { x: number; y: number; z: number }, cam: { x: number; y: number; z: number }): void {
      writeOffsetSegments(line.geometry, points, count, offset);
      line.position.set(cam.x, cam.y, cam.z);
    },
  };
}
