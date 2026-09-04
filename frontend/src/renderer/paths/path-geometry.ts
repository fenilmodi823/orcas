/** Brief §F.6: "falling to ~15% at the antipode." */
export const MIN_PATH_ALPHA = 0.15;

/**
 * Fill the flat position and RGBA-colour buffers a `LineGeometry` wants
 * (`setPositions(array)`, `setColors(array, 4)`) from one sampled orbit
 * (J2000 km, 3 floats/sample, from sampleOrbitPath).
 *
 * The alpha ramp gives direction-of-travel without dashes and with no
 * per-frame work: brightest at the centre sample — which is the object's
 * position at "now", because sampleOrbitPath centres the span on the
 * current instant — down to MIN_PATH_ALPHA at both ends of the period.
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
    const distanceFromNow = mid === 0 ? 0 : Math.abs(i - mid) / mid; // 0 at centre, 1 at the ends
    const alpha = MIN_PATH_ALPHA + (1 - MIN_PATH_ALPHA) * (1 - distanceFromNow);
    colors[i * 4] = rgb.r;
    colors[i * 4 + 1] = rgb.g;
    colors[i * 4 + 2] = rgb.b;
    colors[i * 4 + 3] = alpha;
  }
}
