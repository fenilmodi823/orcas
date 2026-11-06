// frontend/src/renderer/solar/spacecraft-path-line.ts
import type { InterleavedBufferAttribute } from 'three';
import type { Line2, LineGeometry } from 'three-stdlib';
import { createFatLine } from './orbit-line.js';
import { writeSegmentAlpha } from './segment-alpha.js';
import { MISSION_PATH_MAX_POINTS } from './spacecraft-path.js';
import { SEGMENT_PREDICTED } from './spacecraft-trail.js';

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
/** A dash and a gap are each about this long on screen, CSS px. */
const DASH_PX = 8;
const MAX_DASH_SEGMENTS = 4096;

/** Segments per dash so one lasts about `DASH_PX`, a power of 2 so small zooms do not rewrite it. */
export function dashSegmentsFor(segmentKm: number, pxPerKm: number): number {
  const segmentPx = segmentKm * pxPerKm;
  if (!(segmentPx > 0)) return 1;
  return Math.min(MAX_DASH_SEGMENTS, 2 ** Math.max(0, Math.ceil(Math.log2(DASH_PX / segmentPx))));
}

/**
 * The selected spacecraft's whole path: one untapered fat line of `MISSION_PATH_MAX_POINTS`, flat alpha, rebuilt
 * only when `rebuild` is called, its segments repositioned every frame by `place`. Its dashes are regrouped as the
 * zoom changes: 8,192 points over Voyager 1's 76 years are 0.04 px a segment at its System view, so one-segment
 * dashes would read as a solid line.
 */
export function createPathLine(colour: { r: number; g: number; b: number }, widthPx: number) {
  const colours = new Float32Array(MISSION_PATH_MAX_POINTS * 4);
  for (let i = 0; i < MISSION_PATH_MAX_POINTS; i++) colours.set([colour.r, colour.g, colour.b, 1], i * 4);
  const line: Line2 = createFatLine(MISSION_PATH_MAX_POINTS, colours, 1, widthPx);
  line.visible = false;
  let kindsNow: Uint8Array = new Uint8Array(0);
  let countNow = 0;
  let predictedKm = 0; // the mean predicted segment's length
  let dash = 0;
  return {
    line,
    /** New kinds and points in (`count` of them), so the dashes and breaks follow at the next `place`. */
    rebuild(kinds: Uint8Array, count: number, points: Float64Array): void {
      kindsNow = kinds;
      countNow = count;
      let sum = 0;
      let n = 0;
      for (let i = 0; i < count - 1; i++) {
        if (kinds[i] !== SEGMENT_PREDICTED) continue;
        const p = i * 3;
        sum += Math.hypot((points[p + 3] ?? 0) - (points[p] ?? 0), (points[p + 4] ?? 0) - (points[p + 1] ?? 0), (points[p + 5] ?? 0) - (points[p + 2] ?? 0));
        n++;
      }
      predictedKm = n > 0 ? sum / n : 0;
      dash = 0;
    },
    /** `pxPerKm`: CSS px per km at the path's centre, for the dashes. */
    place(
      points: Float64Array,
      count: number,
      offset: { x: number; y: number; z: number },
      cam: { x: number; y: number; z: number },
      pxPerKm: number,
    ): void {
      const want = dashSegmentsFor(predictedKm, pxPerKm);
      if (want !== dash) {
        writeSegmentAlpha(line.geometry, kindsNow, countNow, flat, want);
        dash = want;
      }
      writeOffsetSegments(line.geometry, points, count, offset);
      line.position.set(cam.x, cam.y, cam.z);
    },
  };
}
