import type { MoonSystemId } from '../../data/moon-systems.js';
import { horizonsRelativeState } from './system-centres.js';

/** Points per trail, oldest first, the moon last: 2° apart on a circle. NASA samples adaptively near 3°. */
export const TRAIL_SAMPLES = 181;
/** NASA's moon trails: the planet's hue at 0.7 (its entity list, read 2026-10-12), nothing at the oldest point. */
export const TRAIL_ALPHA = 0.7;
/** NASA's trail widths at the body: 2 px, 4 on hover (Reference §4.3). */
export const TRAIL_WIDTH_PX = 2;
export const TRAIL_HOVER_WIDTH_PX = 4;

const _state = new Float64Array(6);

/**
 * One orbit's time, s, from a centre-relative state [x, y, z, vx, vy, vz] (km, km/s) and μ (km³/s²): the
 * osculating period, as NASA's `_getAutoLength` takes it. An unbound state falls back to NASA's 2π|r×v|/v².
 */
export function osculatingPeriodS(state6: ArrayLike<number>, muKm3S2: number): number {
  const x = state6[0] ?? NaN;
  const y = state6[1] ?? NaN;
  const z = state6[2] ?? NaN;
  const vx = state6[3] ?? NaN;
  const vy = state6[4] ?? NaN;
  const vz = state6[5] ?? NaN;
  const v2 = vx * vx + vy * vy + vz * vz;
  const energy = v2 / 2 - muKm3S2 / Math.hypot(x, y, z);
  if (energy < 0) {
    const a = -muKm3S2 / (2 * energy);
    return 2 * Math.PI * Math.sqrt((a * a * a) / muKm3S2);
  }
  return (2 * Math.PI * Math.hypot(y * vz - z * vy, z * vx - x * vz, x * vy - y * vx)) / v2;
}

/**
 * A moon's trail (S6b, NASA Eyes' TrailComponent): where it was over the last orbit, relative to the export's
 * centre (its system barycentre, or Mars), oldest first and the moon now last, into `out` (km, 3 per point).
 * Points before the data begins sit at its first point, so the trail is shorter there, as NASA's coverage makes
 * it; a point in a gap repeats the one before. False, and `out` untouched, if the moon has no data now.
 */
export function writeMoonTrail(system: MoonSystemId, naifId: number, epochMs: number, muKm3S2: number, out: Float64Array): boolean {
  if (horizonsRelativeState(system, naifId, epochMs, _state) === null) return false;
  const periodMs = osculatingPeriodS(_state, muKm3S2) * 1000;
  const last = TRAIL_SAMPLES - 1;
  let firstValid = -1;
  for (let i = 0; i <= last; i++) {
    const has = horizonsRelativeState(system, naifId, epochMs - periodMs * (1 - i / last), _state) !== null;
    if (has) {
      if (firstValid < 0) firstValid = i;
      out[i * 3] = _state[0] ?? NaN;
      out[i * 3 + 1] = _state[1] ?? NaN;
      out[i * 3 + 2] = _state[2] ?? NaN;
    } else if (firstValid >= 0) {
      out.copyWithin(i * 3, (i - 1) * 3, i * 3);
    }
  }
  for (let i = 0; i < firstValid; i++) out.copyWithin(i * 3, firstValid * 3, firstValid * 3 + 3);
  return true;
}

/** NASA's trail alpha, `mix(alphaFade, 1, u)` with `alphaFade` 0: nothing at the oldest point, `peak` at the moon. */
export function writeTrailColours(rgb: { r: number; g: number; b: number }, peak: number, colours: Float32Array): void {
  const last = TRAIL_SAMPLES - 1;
  for (let i = 0; i <= last; i++) {
    colours[i * 4] = rgb.r;
    colours[i * 4 + 1] = rgb.g;
    colours[i * 4 + 2] = rgb.b;
    colours[i * 4 + 3] = (peak * i) / last;
  }
}
