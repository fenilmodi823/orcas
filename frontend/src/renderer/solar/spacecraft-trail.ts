// frontend/src/renderer/solar/spacecraft-trail.ts
import { GM_EARTH, GM_MOON } from '@orcas/physics';
import type { HorizonsIndex, Span } from '../../data/horizons-index.js';
import { etSecondsFromUtcMs } from '../../data/planet-ephemeris.js';
import { osculatingPeriodS } from './moon-trails.js';
import { PLANETS } from './planets.js';

/** Segment kinds: flown is drawn solid, predicted dashed, hidden never (a gap, a change of centre, a jump). */
export const SEGMENT_FLOWN = 0;
export const SEGMENT_PREDICTED = 1;
export const SEGMENT_HIDDEN = 2;

/** Points per trail, oldest first, the spacecraft last. */
export const SPACECRAFT_TRAIL_SAMPLES = 181;
/** A cruise trail (centre = the barycentre) spans one year, s. */
export const CRUISE_TRAIL_S = 365.25 * 86400;

const _s = new Float64Array(6);

/** μ about a Horizons centre, km³/s²; null for the barycentre, which a cruise trail measures by the year instead. */
export function centreGmKm3S2(centre: number): number | null {
  if (centre === 399) return GM_EARTH;
  if (centre === 301) return GM_MOON;
  const planet = PLANETS.find((p) => p.naifId === centre);
  return planet ? planet.gmKm3S2 : null;
}

const inJump = (etS: number, jumps: readonly Span[]) => jumps.some(([a, b]) => etS >= a && etS <= b);
const straddles = (e0: number, e1: number, jumps: readonly Span[]) => jumps.some(([a, b]) => e0 < a && e1 > b);

/**
 * A spacecraft's trail: one orbit about its centre now (one year if that is the barycentre), as points in ICRF km
 * relative to that centre (`outKm`, 3 per point, oldest first, the spacecraft last) and one kind per segment
 * (`kinds`). A sample with no state, or another centre, repeats the previous point and hides both segments touching
 * it; samples before the first valid one take its point and hide. A segment in or across a jump span (ET s) is
 * hidden; otherwise it is predicted if its later end is after `flownUntilUtcMs` (UTC ms), else flown.
 * Returns the centre now (NAIF id), or null with nothing written if the spacecraft has no data at `epochMs`.
 */
export function writeSpacecraftTrail(
  index: HorizonsIndex,
  naifId: number,
  epochMs: number,
  flownUntilUtcMs: number,
  jumps: readonly Span[],
  outKm: Float64Array,
  kinds: Uint8Array,
): number | null {
  const etNow = etSecondsFromUtcMs(epochMs);
  const centre = index.stateInto(naifId, etNow, _s);
  if (centre === null) return null;
  const gm = centreGmKm3S2(centre);
  const lengthS = gm === null ? CRUISE_TRAIL_S : osculatingPeriodS(_s, gm);
  const last = SPACECRAFT_TRAIL_SAMPLES - 1;
  const flownUntilEtS = etSecondsFromUtcMs(flownUntilUtcMs);
  let firstValid = -1;
  let prevEtS = NaN;
  let prevOk = false;
  for (let i = 0; i <= last; i++) {
    const etS = etNow - lengthS * (1 - i / last);
    const ok = index.stateInto(naifId, etS, _s) === centre;
    if (ok) {
      if (firstValid < 0) firstValid = i;
      outKm.set(_s.subarray(0, 3), i * 3);
    } else if (firstValid >= 0) {
      outKm.copyWithin(i * 3, (i - 1) * 3, i * 3);
    }
    if (i > 0) {
      const hidden = !ok || !prevOk || inJump(etS, jumps) || inJump(prevEtS, jumps) || straddles(prevEtS, etS, jumps);
      kinds[i - 1] = hidden ? SEGMENT_HIDDEN : etS > flownUntilEtS ? SEGMENT_PREDICTED : SEGMENT_FLOWN;
    }
    prevEtS = etS;
    prevOk = ok;
  }
  for (let i = 0; i < firstValid; i++) outKm.copyWithin(i * 3, firstValid * 3, firstValid * 3 + 3);
  return centre;
}
