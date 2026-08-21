export type LandingPhase = 'point' | 'rings' | 'tracks' | 'resolve' | 'hold' | 'wordmark' | 'settle' | 'done';

/** Storyboard from Branding.md#Logo animation. Every "at" is ms from mount. */
export const TIMELINE: readonly { phase: LandingPhase; at: number }[] = [
  { phase: 'point', at: 0 },
  { phase: 'rings', at: 400 },
  { phase: 'tracks', at: 800 },
  { phase: 'resolve', at: 1600 },
  { phase: 'hold', at: 2000 },
  { phase: 'wordmark', at: 2400 },
  { phase: 'settle', at: 3000 },
  { phase: 'done', at: 3600 },
];

export const REDUCED_MOTION_FADE_MS = 300;

/**
 * In-memory only — Rules.md bans localStorage on a critical path, and
 * "once per session" here means once per page load, not persisted across
 * reloads. Resets automatically on every full reload.
 */
let hasPlayed = false;

export function landingSequenceHasPlayed(): boolean {
  return hasPlayed;
}

export function markLandingSequencePlayed(): void {
  hasPlayed = true;
}

/** Test-only escape hatch — module state otherwise leaks across test cases. */
export function resetLandingSequenceForTests(): void {
  hasPlayed = false;
}
