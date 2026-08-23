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
