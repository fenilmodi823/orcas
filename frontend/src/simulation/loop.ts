import { advanceTicks, ticksToEpochMs } from '../time/clock.js';
import type { KeyframeRing } from './keyframe-ring.js';

export interface StepResult {
  readonly clockTicks: number;
  readonly epochMs: number;
  /** True once the clock has left the ring's current window — brief
   * §A.5 "Segment scheduling": the caller should request the next
   * window now, before the clock actually runs out of valid data. */
  readonly needsRebuild: boolean;
}

/**
 * One clock tick plus the segment-boundary check — brief §A.7 step 1
 * and §A.5. Pure: no I/O, no worker calls, so it is fully unit-testable
 * without a real rAF loop or real Workers — the same split M1.1 used
 * for its worker pool (testable scheduling logic vs. the thin real
 * binding, verified live in `use-simulation-loop.ts`). `dtMs` is
 * expected already clamped by the caller (brief §A.7 step 0:
 * `min(dt, 100ms)`).
 */
export function stepClock(clockTicks: number, dtMs: number, rate: number, ring: KeyframeRing): StepResult {
  const nextTicks = advanceTicks(clockTicks, dtMs, rate);
  const epochMs = ticksToEpochMs(nextTicks);
  const needsRebuild = epochMs < ring.windowT0Ms || epochMs >= ring.windowT1Ms;
  return { clockTicks: nextTicks, epochMs, needsRebuild };
}

/** Extra coverage past the current epoch when running in reverse. The window
 * is half-open, [t0, t1), so a reverse window ending exactly at the epoch
 * would exclude the epoch itself and ask for another rebuild on the spot. */
export const REVERSE_LEAD_MS = 1_000;

/**
 * Which span to build keyframes for, given the direction time is running.
 *
 * The window has to lie *ahead of the clock in the direction of travel*. It
 * used to be `[epoch, epoch + window)` regardless, which is right forwards and
 * wrong backwards: the epoch falls while the asynchronous rebuild runs, so
 * every rebuild finished already behind its own window, the ring never caught
 * up, and every object read as stale for as long as time ran in reverse.
 * Forwards is unchanged. Paused counts as forwards.
 */
export function rebuildWindowFor(
  epochMs: number,
  rate: number,
  windowMs: number,
): { readonly t0Ms: number; readonly t1Ms: number } {
  if (rate < 0) return { t0Ms: epochMs - windowMs, t1Ms: epochMs + REVERSE_LEAD_MS };
  return { t0Ms: epochMs, t1Ms: epochMs + windowMs };
}
