import { smoothstep } from '../camera/easing.js';

/**
 * ⭐ The single source of the Tier 0 → Tier 1 cross-fade band (brief §B.6).
 *
 * Both tiers read the band from HERE and nowhere else: Tier 0 receives it
 * as the `uLodLoPx`/`uLodHiPx` uniforms (TierZeroPoints.tsx), Tier 1 calls
 * `tier1Alpha` directly. §F.7 is blunt about why — "two independently-tuned
 * constants will drift during refactoring and produce a faint brightness
 * dip or bump at the crossover that is very hard to diagnose and
 * impossible to un-see."
 *
 * ⚠️ Never inline these numbers into a shader string or a component.
 */
export interface LodBand {
  readonly loPx: number;
  readonly hiPx: number;
}

// Typed `number`, not `as const` literals: consumers assign the edges into
// mutable locals (tier1-select's bisection) and, from Task 11, into dev-panel
// tunables. Literal types would make both a type error.
export const LOD_BAND_PX: LodBand = { loPx: 3, hiPx: 6 };

/** Tier 1's alpha: 0 below the band, 1 above it, smooth across. */
export function tier1Alpha(px: number): number {
  return smoothstep(LOD_BAND_PX.loPx, LOD_BAND_PX.hiPx, px);
}

/** Tier 0's alpha. Derived from `tier1Alpha`, never computed independently,
 * so the two provably sum to 1 rather than merely being tuned to. */
export function tier0Alpha(px: number): number {
  return 1 - tier1Alpha(px);
}
