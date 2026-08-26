import type { NoradId, ObjectMeta } from '../../data/catalog-types.js';
import { unpackIdBytes } from './points-pick-id.js';

const HOVER_DEBOUNCE_FRAMES = 2; // brief §D.4

/**
 * Scans a windowSize x windowSize RGBA readback and returns the byte
 * offset of the best real hit — the one nearest the window's centre
 * among all non-"nothing" pixels (brief §D.2: "take the id nearest the
 * centre among non-zero samples... makes small debris feel selectable
 * without any special-casing"). Returns null if every pixel is "nothing."
 */
export function findBestPixel(pixels: Uint8Array, windowSize: number): number | null {
  const centre = (windowSize - 1) / 2;
  let bestOffset: number | null = null;
  let bestDistanceSq = Infinity;

  for (let row = 0; row < windowSize; row++) {
    for (let col = 0; col < windowSize; col++) {
      const pixelIndex = row * windowSize + col;
      const offset = pixelIndex * 4;
      if (unpackIdBytes(pixels, offset) === null) continue;
      const dx = col - centre;
      const dy = row - centre;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq < bestDistanceSq) {
        bestDistanceSq = distanceSq;
        bestOffset = offset;
      }
    }
  }

  return bestOffset;
}

/** Maps a decoded entity index back to a NORAD id via the same objects
 * array FrameState is keyed by. Null if the index is out of range — a
 * stale pick that arrived after the catalogue changed size. */
export function resolveEntityIndexToNorad(
  entityIndex: number,
  objects: readonly ObjectMeta[],
): NoradId | null {
  const object = objects[entityIndex];
  return object ? object.norad : null;
}

export interface HoverDebounceState {
  /** Currently displayed/promoted hover value. */
  value: NoradId | null;
  /** The candidate currently being counted toward promotion — distinct
   * from `value` while a new candidate hasn't been seen for enough
   * consecutive frames yet. */
  pendingCandidate: NoradId | null;
  sameCandidateFrameCount: number;
}

export const INITIAL_HOVER_DEBOUNCE_STATE: HoverDebounceState = {
  value: null,
  pendingCandidate: null,
  sameCandidateFrameCount: 0,
};

/**
 * Brief §D.4: promote a new hover candidate to the visible value only
 * after it has been the candidate for 2 consecutive frames, so a cursor
 * sweeping a dense field doesn't strobe the tether. Clearing (candidate
 * becomes null) is immediate — only appearing is debounced, not
 * disappearing. Tracks `pendingCandidate` separately from `value` so a
 * THIRD candidate arriving mid-debounce restarts the count instead of
 * inheriting whatever count the previous (different) candidate had
 * accumulated — a real bug this function's own test caught.
 */
export function debounceHover(candidate: NoradId | null, state: HoverDebounceState): HoverDebounceState {
  if (candidate === null) {
    return { value: null, pendingCandidate: null, sameCandidateFrameCount: 0 };
  }
  if (candidate === state.value) {
    return { value: candidate, pendingCandidate: candidate, sameCandidateFrameCount: 0 };
  }
  if (candidate === state.pendingCandidate) {
    const nextCount = state.sameCandidateFrameCount + 1;
    if (nextCount >= HOVER_DEBOUNCE_FRAMES) {
      return { value: candidate, pendingCandidate: candidate, sameCandidateFrameCount: nextCount };
    }
    return { value: state.value, pendingCandidate: candidate, sameCandidateFrameCount: nextCount };
  }
  // A different candidate than the one we were counting — restart.
  return { value: state.value, pendingCandidate: candidate, sameCandidateFrameCount: 1 };
}
