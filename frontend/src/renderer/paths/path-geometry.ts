/** The faintest the trail gets, just ahead of the object. NASA Eyes' trail
 * fades to nothing there; ORCAS keeps the whole orbit legible because these
 * are the objects Fenil asked to have highlighted (A.10). Tunable by eye. */
export const TRAIL_FLOOR = 0.15;

/**
 * Fill the flat position and RGBA-colour buffers a `LineGeometry` wants
 * (`setPositions(array)`, `setColors(array, 4)`) from one sampled orbit
 * (J2000 km, 3 floats/sample, from sampleOrbitPath).
 *
 * NASA Eyes' trail (S1, Reference - NASA Eyes §4.3; its shader is
 * `alpha × mix(alphaFade, 1, u)`, u running from the oldest point to the
 * object): brightest at the object, fading back along the path it came
 * from, faintest just ahead of it. This replaces the 2026-09-13 design,
 * which drew the future half at full strength and faded the past.
 *
 * `sampleOrbitPath` centres the span on "now" and covers exactly one period,
 * so a sample s periods from "now" (−½ ≤ s ≤ ½) is where the object was
 * τ = −s periods ago if s ≤ 0, or τ = 1 − s periods ago if s > 0 — a point
 * ahead on a closed orbit is where it was almost a full turn ago. Alpha falls
 * linearly with τ from 1 to `TRAIL_FLOOR`. The two ends of the span are the
 * same place (τ = ½ both), so the ring has no seam there.
 *
 * Units pass straight through: 1 km = 1 scene unit. Both target buffers are
 * caller-owned and reused across resamples — this function allocates nothing.
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
    const s = sampleCount > 1 ? (i - mid) / (sampleCount - 1) : 0; // periods from "now"
    const periodsAgo = s <= 0 ? -s : 1 - s;
    const alpha = 1 - (1 - TRAIL_FLOOR) * periodsAgo;
    colors[i * 4] = rgb.r;
    colors[i * 4 + 1] = rgb.g;
    colors[i * 4 + 2] = rgb.b;
    colors[i * 4 + 3] = alpha;
  }
}
