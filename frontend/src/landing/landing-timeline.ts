export type LandingPhase = 'ring' | 'surface' | 'waves' | 'ping' | 'wordmark' | 'settle' | 'done';

/**
 * Storyboard from Branding.md#Logo animation (breach, ping, settle — shared
 * with the portfolio's loader since 2026-11-03). Every "at" is ms from mount;
 * settle → done is the brand's --motion-camera glide (900ms).
 */
export const TIMELINE: readonly { phase: LandingPhase; at: number }[] = [
  { phase: 'ring', at: 0 },
  { phase: 'surface', at: 400 },
  { phase: 'waves', at: 800 },
  { phase: 'ping', at: 1600 },
  { phase: 'wordmark', at: 2400 },
  { phase: 'settle', at: 3300 },
  { phase: 'done', at: 4200 },
];

/** How long the ping takes to reach PING.r; each dot lights at its share of it. */
export const PING_MS = 1100;

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
