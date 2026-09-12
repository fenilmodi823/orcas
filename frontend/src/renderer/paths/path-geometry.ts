/**
 * Fill the flat position and RGBA-colour buffers a `LineGeometry` wants
 * (`setPositions(array)`, `setColors(array, 4)`) from one sampled orbit
 * (J2000 km, 3 floats/sample, from sampleOrbitPath).
 *
 * Direction-of-travel, not recency (revised 2026-09-13, replacing an
 * earlier symmetric "fades to 15% at both ends" design — the ring used to
 * dim identically ahead and behind, which read as generic rather than
 * showing where the object is actually headed). `sampleOrbitPath` centres
 * the span on the current instant and covers exactly one full period, so
 * the centre sample is "now" and index 0 is the trailing point exactly
 * half an orbit behind:
 *
 * - From "now" onward (the known, predicted future half) the ring is
 *   full brightness, undimmed — there is nothing uncertain about it.
 * - Behind "now" it fades linearly, reaching fully transparent exactly
 *   at the trailing half-orbit point (index 0).
 *
 * Units pass straight through: 1 km = 1 scene unit on the /points route.
 * Both target buffers are caller-owned and reused across resamples —
 * this function allocates nothing.
 */
export function writePathBuffers(
  samplesKm: Float32Array,
  sampleCount: number,
  rgb: { r: number; g: number; b: number },
  positions: Float32Array,
  colors: Float32Array,
): void {
  if (positions.length < sampleCount * 3) {
    throw new RangeError(`positions holds ${positions.length}, need ${sampleCount * 3}`);
  }
  if (colors.length < sampleCount * 4) {
    throw new RangeError(`colors holds ${colors.length}, need ${sampleCount * 4}`);
  }
  const mid = (sampleCount - 1) / 2;
  for (let i = 0; i < sampleCount; i++) {
    positions[i * 3] = samplesKm[i * 3];
    positions[i * 3 + 1] = samplesKm[i * 3 + 1];
    positions[i * 3 + 2] = samplesKm[i * 3 + 2];
    // 0 at the trailing half-orbit point, ramping to 1 at "now", flat at
    // 1 for the whole predicted-future half.
    const alpha = mid === 0 || i >= mid ? 1 : i / mid;
    colors[i * 4] = rgb.r;
    colors[i * 4 + 1] = rgb.g;
    colors[i * 4 + 2] = rgb.b;
    colors[i * 4 + 3] = alpha;
  }
}
