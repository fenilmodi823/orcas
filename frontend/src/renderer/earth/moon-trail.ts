import { moonPositionJ2000Km } from '@orcas/physics';

/** One sidereal month, the Moon's orbital period against the stars. */
export const SIDEREAL_MONTH_MS = 27.321661 * 86_400_000;
export const MOON_TRAIL_SAMPLES = 256;

/**
 * The Moon's path over the sidereal month ending at `nowMs`: oldest first,
 * the Moon's current position last. Positions km, J2000; alpha rises from
 * faint at the oldest end to strong at the Moon, so the trail also shows the
 * direction of travel. Writes `positions` (3 per sample) and `colours`
 * (rgba per sample, rgb from `rgb`).
 */
export function writeMoonTrail(
  nowMs: number,
  rgb: { r: number; g: number; b: number },
  positions: Float32Array,
  colours: Float32Array,
): void {
  const last = MOON_TRAIL_SAMPLES - 1;
  for (let i = 0; i <= last; i++) {
    const p = moonPositionJ2000Km(new Date(nowMs - SIDEREAL_MONTH_MS * (1 - i / last)));
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;
    colours[i * 4] = rgb.r;
    colours[i * 4 + 1] = rgb.g;
    colours[i * 4 + 2] = rgb.b;
    colours[i * 4 + 3] = 0.05 + 0.6 * (i / last) ** 1.5;
  }
}
