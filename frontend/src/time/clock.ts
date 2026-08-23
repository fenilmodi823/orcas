/**
 * Deterministic simulation clock — Phase-4 brief §E.5: "state = f(epoch)
 * purely," and the clock itself advances in integer ticks so two runs on
 * two machines never diverge. `TICK_HZ` is a power of two so
 * tick-to-second conversion is exact in binary floating point.
 *
 * Deviates from the brief's literal "TAI seconds since J2000" origin:
 * the rest of this codebase already represents time as milliseconds
 * since the Unix epoch (`ObjectMeta.epochMs`, `PropagationSegment.t0Ms`/
 * `t1Ms` — M1.0/M1.1 precedent). Re-basing the whole app to
 * TAI-since-J2000 is out of scope for this milestone; `epochTicks` here
 * counts ticks since the Unix epoch instead. The determinism-critical
 * property — integer accumulation, never float accumulation — is
 * identical either way.
 */
export const TICK_HZ = 1024;

/**
 * Round-half-away-from-zero. `Math.round` is round-half-up
 * (asymmetric: `Math.round(-0.5) === 0`, not `-1`), which would make a
 * forward step and its exact reverse not cancel at a tie. This makes
 * `advanceTicks` exactly antisymmetric in `rate` for any input,
 * including ties — the property the reversibility test below depends on.
 */
function roundHalfAwayFromZero(x: number): number {
  return x >= 0 ? Math.round(x) : -Math.round(-x);
}

/**
 * Advance the clock by one step. Pure — no reads of wall-clock time, no
 * hidden state. `epochTicks`: integer ticks in. `dtMs`: elapsed
 * wall-clock milliseconds (already clamped by the caller — brief §A.7
 * step 0). `rate`: signed simulation-seconds-per-wall-second multiplier;
 * `0` pauses. Returns the new integer `epochTicks`.
 */
export function advanceTicks(epochTicks: number, dtMs: number, rate: number): number {
  const deltaTicks = roundHalfAwayFromZero(rate * (dtMs / 1000) * TICK_HZ);
  return epochTicks + deltaTicks;
}

/** Convert milliseconds-since-Unix-epoch to integer simulation ticks. */
export function epochMsToTicks(epochMs: number): number {
  return Math.round((epochMs / 1000) * TICK_HZ);
}

/** Convert integer simulation ticks back to milliseconds-since-Unix-epoch. */
export function ticksToEpochMs(epochTicks: number): number {
  return (epochTicks / TICK_HZ) * 1000;
}
