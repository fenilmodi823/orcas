const PI = Math.PI;

export interface GroundTrackSegments {
  /** Vertex pairs for `LineSegments`: `[p0,p1, p1,p2, ...]`, skipping any
   * pair that crosses the atan2 branch cut. Only the first
   * `segmentCount * 6` floats are valid. */
  readonly buffer: Float32Array;
  readonly segmentCount: number;
}

/**
 * Expand `samples` ground-track positions into `LineSegments` vertex pairs
 * (mirrors `orbit-path.ts`'s `toLineSegments`), but **omitting** any pair
 * whose azimuth crosses the ±180° branch cut instead of drawing a chord
 * through the globe.
 *
 * A real per-step azimuth change here is small — 180 samples over one
 * orbital period is a few degrees a step — so a raw `azimuthsRad[i+1] -
 * azimuthsRad[i]` with `|delta| > π` can only mean the pair straddles
 * `atan2`'s wraparound (e.g. +179° to -179°), not a genuine ~360° swing in
 * one step. That's the antimeridian split: skip drawing that one pair, all
 * others draw normally.
 */
export function toGroundTrackSegments(
  positions: Float32Array,
  azimuthsRad: Float32Array,
  samples: number,
  out?: Float32Array,
): GroundTrackSegments {
  const maxSegments = samples - 1;
  const buffer = out ?? new Float32Array(maxSegments * 6);
  if (buffer.length < maxSegments * 6) {
    throw new RangeError(`out holds ${buffer.length} floats, need ${maxSegments * 6}`);
  }

  let segmentCount = 0;
  for (let i = 0; i < maxSegments; i++) {
    const delta = azimuthsRad[i + 1] - azimuthsRad[i];
    if (Math.abs(delta) > PI) continue; // antimeridian split: don't draw a chord through the globe

    const w = segmentCount * 6;
    buffer[w] = positions[i * 3];
    buffer[w + 1] = positions[i * 3 + 1];
    buffer[w + 2] = positions[i * 3 + 2];
    buffer[w + 3] = positions[(i + 1) * 3];
    buffer[w + 4] = positions[(i + 1) * 3 + 1];
    buffer[w + 5] = positions[(i + 1) * 3 + 2];
    segmentCount++;
  }

  return { buffer, segmentCount };
}
