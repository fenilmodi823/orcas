/** Only tier that exists today — Tier 1/2 objects and Earth-picking are
 * out of scope for M1.5 (see the M1.5 plan's Global Constraints). */
export const TIER_POINT = 1;

/**
 * Direct TypeScript port of the brief's §D.2 packId GLSL — this is the
 * literal spec the pick fragment shader also implements, not
 * independent verification on its own. `id + 1` reserves raw value 0
 * for "nothing was hit." Returns byte values 0-255, RGBA order.
 */
export function packIdBytes(entityIndex: number, tierTag: number): [number, number, number, number] {
  const i = entityIndex + 1;
  return [i % 256, Math.floor(i / 256) % 256, Math.floor(i / 65536), tierTag];
}

/**
 * Reads one RGBA pixel (4 bytes starting at `offset`) from a pick-buffer
 * readback and decodes it back to an entity index. Returns null for the
 * reserved "nothing hit" value (all-zero RGB).
 */
export function unpackIdBytes(
  bytes: Uint8Array | Uint8ClampedArray,
  offset: number,
): { entityIndex: number; tierTag: number } | null {
  const r = bytes[offset];
  const g = bytes[offset + 1];
  const b = bytes[offset + 2];
  const a = bytes[offset + 3];
  const i = r + g * 256 + b * 65536;
  if (i === 0) return null;
  return { entityIndex: i - 1, tierTag: a };
}
