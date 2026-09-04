/** Dimmest point of the trail (the oldest sample), fading up to full
 * brightness at the newest (closest to the object right now). Distinct
 * from orbit paths' MIN_PATH_ALPHA (0.15, centred fade) — a trail's tail
 * end is meant to read as fainter than a path's antipode, since it is
 * genuinely older data, not just the far side of a permanent orbit. */
export const MIN_TRAIL_ALPHA = 0.05;

/**
 * Fill the flat position and RGBA-colour buffers a `LineGeometry` wants
 * from a trail ring's oldest-to-newest samples (`trail-ring.ts`'s
 * `readOrdered`).
 *
 * Alpha by age (brief §F.6): dimmest at the oldest sample (index 0),
 * full brightness at the newest (index `count - 1`, nearest the
 * object's current position) — monotonic, unlike an orbit path's
 * centred fade, because a trail has no "current position" in the
 * middle of its buffer the way a path does.
 *
 * Units pass straight through: 1 km = 1 scene unit on the /points route.
 * Both target buffers are caller-owned and reused across appends — this
 * function allocates nothing.
 */
export function writeTrailBuffers(
  orderedPositionsKm: Float32Array,
  count: number,
  rgb: { r: number; g: number; b: number },
  positions: Float32Array,
  colors: Float32Array,
): void {
  if (positions.length < count * 3) {
    throw new RangeError(`positions holds ${positions.length}, need ${count * 3}`);
  }
  if (colors.length < count * 4) {
    throw new RangeError(`colors holds ${colors.length}, need ${count * 4}`);
  }
  for (let i = 0; i < count; i++) {
    positions[i * 3] = orderedPositionsKm[i * 3];
    positions[i * 3 + 1] = orderedPositionsKm[i * 3 + 1];
    positions[i * 3 + 2] = orderedPositionsKm[i * 3 + 2];
    const age = count <= 1 ? 1 : i / (count - 1); // 0 at the oldest, 1 at the newest
    const alpha = MIN_TRAIL_ALPHA + (1 - MIN_TRAIL_ALPHA) * age;
    colors[i * 4] = rgb.r;
    colors[i * 4 + 1] = rgb.g;
    colors[i * 4 + 2] = rgb.b;
    colors[i * 4 + 3] = alpha;
  }
}
