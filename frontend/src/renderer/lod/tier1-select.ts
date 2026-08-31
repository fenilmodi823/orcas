import { Flag } from '../../simulation/flags.js';
import { apparentPx } from '../points/points-shading.js';
import { LOD_BAND_PX } from './lod-band.js';

/** Brief §B.4. Bounded cost is the entire point of the tier. */
export const TIER1_CAP = 2000;

const BISECTION_PASSES = 16;

export interface Tier1SelectArgs {
  readonly positions: Float32Array; // 3N, km
  readonly flags: Uint8Array; // N
  readonly count: number;
  readonly camPosKm: { readonly x: number; readonly y: number; readonly z: number };
  readonly pixelsPerRadian: number;
  readonly radiusKm: number;
}

/** Allocate once at mount; `selectTier1` refills it forever after. */
export function createTier1Buffer(cap: number = TIER1_CAP): Uint32Array {
  return new Uint32Array(cap);
}

function pxAt(a: Tier1SelectArgs, i: number): number {
  const dx = a.positions[i * 3] - a.camPosKm.x;
  const dy = a.positions[i * 3 + 1] - a.camPosKm.y;
  const dz = a.positions[i * 3 + 2] - a.camPosKm.z;
  return apparentPx(a.radiusKm, Math.sqrt(dx * dx + dy * dy + dz * dz), a.pixelsPerRadian);
}

function countAbove(a: Tier1SelectArgs, threshold: number): number {
  let n = 0;
  for (let i = 0; i < a.count; i++) {
    if ((a.flags[i] & Flag.Stale) !== 0) continue;
    if (pxAt(a, i) >= threshold) n++;
  }
  return n;
}

/**
 * Fill `out` with the indices of objects large enough for Tier 1, capped
 * at `out.length`. Returns how many were written.
 *
 * When more qualify than the cap allows, the threshold is raised by
 * bisection rather than by sorting: a full sort at 46,250 is ~700k
 * comparisons and allocates, whereas 16 counting passes are bounded,
 * allocation-free, and resolve the cut exactly at the cap.
 *
 * ponytail: the cap does not bind today — with a 10 m assumed radius an
 * object only reaches 3 px at ~4 km. Built because §B.4 makes bounded cost
 * the tier's defining property, and real sizes will make it bind.
 */
export function selectTier1(args: Tier1SelectArgs, out: Uint32Array): number {
  const cap = out.length;
  let threshold = LOD_BAND_PX.loPx;

  if (countAbove(args, threshold) > cap) {
    let lo = threshold;
    let hi = threshold;
    for (let i = 0; i < args.count; i++) {
      if ((args.flags[i] & Flag.Stale) !== 0) continue;
      const px = pxAt(args, i);
      if (px > hi) hi = px;
    }
    for (let pass = 0; pass < BISECTION_PASSES; pass++) {
      const mid = (lo + hi) / 2;
      if (countAbove(args, mid) > cap) lo = mid;
      else hi = mid;
    }
    threshold = hi; // the side that satisfies the cap
  }

  let n = 0;
  for (let i = 0; i < args.count && n < cap; i++) {
    if ((args.flags[i] & Flag.Stale) !== 0) continue;
    if (pxAt(args, i) >= threshold) out[n++] = i;
  }
  return n;
}
