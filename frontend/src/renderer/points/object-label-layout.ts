/**
 * Label declutter (P4.D28, brief §13.4.6): opacity for each label
 * candidate as a function of camera distance, local screen-space density,
 * and a hard rank cap — every factor tunable-by-eye, like the rest of
 * M1.7b/c's visual constants. Pure so the algorithm is testable without a
 * running scene; `ObjectLabels.tsx` supplies the live screen positions.
 */

import type { Vector3 } from 'three';
import { earthBlocks } from '../earth/body-screen.js';

/**
 * Whether a label belongs on screen at all: in front of the camera
 * (`projectedZ`, NDC, ≤ 1) and not behind the Earth from where the camera
 * stands. NASA Eyes draws nothing behind a body and fades its label out
 * (B.14, Reference - NASA Eyes §4.2). Positions in km, scene frame.
 */
export function labelOnScreen(projectedZ: number, cameraKm: Vector3, objectKm: Vector3): boolean {
  return projectedZ <= 1 && !earthBlocks(cameraKm, objectKm);
}

/** Well inside object-mode framing (`tier1-write.ts`'s own reference point
 * for "fully framed on one object" is ~0.0825 km) — labels fade toward 0
 * as the camera approaches this, since the camera is now focused on one
 * specific thing and every OTHER label is noise. */
const DISTANCE_FADE_NEAR_KM = 0.5;
/** Comfortably zoomed out — full opacity from here outward. */
const DISTANCE_FADE_FAR_KM = 10;
/** Two candidates whose projected centres land within this many screen
 * pixels of each other are considered crowded. */
const DENSITY_RADIUS_PX = 60;

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/** 0 at/inside `DISTANCE_FADE_NEAR_KM`, 1 at/beyond `DISTANCE_FADE_FAR_KM`,
 * linear between. Exported so the "near object-mode, far at rest" shape is
 * independently checkable. */
export function distanceFadeFactor(camRadiusKm: number): number {
  return clamp01((camRadiusKm - DISTANCE_FADE_NEAR_KM) / (DISTANCE_FADE_FAR_KM - DISTANCE_FADE_NEAR_KM));
}

export interface LabelCandidate {
  readonly xPx: number;
  readonly yPx: number;
  /** Lower = more significant (`significance-rank.ts`'s order). */
  readonly rank: number;
  /** False when the candidate projects behind the camera — never draw a
   * label for something not actually on screen. */
  readonly visible: boolean;
}

export interface ComputeLabelOpacitiesArgs {
  readonly candidates: readonly LabelCandidate[];
  /** Index into `candidates` that is the current selection, or -1 for
   * none. Exempt from the rank cap and crowding; since S1 it follows the
   * distance fade like every other label (NASA Eyes hides the focused
   * object's own label close up) — and 0 if it isn't on screen. */
  readonly selectedSlot: number;
  readonly camRadiusKm: number;
  /** Hard cap on simultaneously-visible non-exempt labels. */
  readonly cap: number;
}

/**
 * One opacity per candidate, same order as `candidates`. Beyond the cap,
 * exactly the lowest-rank candidates are dropped (forced to 0) — ties
 * broken by array order, which `significance-rank.ts`'s own total order
 * never produces (no two objects share a rank).
 */
export function computeLabelOpacities(args: ComputeLabelOpacitiesArgs): Float32Array {
  const { candidates, selectedSlot, camRadiusKm, cap } = args;
  const n = candidates.length;
  const opacity = new Float32Array(n);
  const distanceFactor = distanceFadeFactor(camRadiusKm);

  const byRank = candidates
    .map((_, i) => i)
    .filter((i) => i !== selectedSlot)
    .sort((a, b) => candidates[a].rank - candidates[b].rank);
  const kept = new Set(byRank.slice(0, cap));

  for (let i = 0; i < n; i++) {
    if (i === selectedSlot) {
      // Exempt from the cap and from crowding, not from the distance fade:
      // close up the object fills the view and its tether names it, so its
      // own label hides, as in NASA Eyes (Reference §4.2).
      opacity[i] = candidates[i].visible ? distanceFactor : 0;
      continue;
    }
    if (!candidates[i].visible || !kept.has(i)) {
      opacity[i] = 0;
      continue;
    }
    let nearby = 0;
    for (let j = 0; j < n; j++) {
      if (j === i || !candidates[j].visible) continue;
      if (j !== selectedSlot && !kept.has(j)) continue; // a hidden candidate doesn't crowd a visible one
      const dx = candidates[i].xPx - candidates[j].xPx;
      const dy = candidates[i].yPx - candidates[j].yPx;
      if (dx * dx + dy * dy < DENSITY_RADIUS_PX * DENSITY_RADIUS_PX) nearby++;
    }
    const densityFactor = 1 / (1 + nearby);
    opacity[i] = distanceFactor * densityFactor;
  }

  return opacity;
}
