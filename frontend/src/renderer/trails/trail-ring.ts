/**
 * A fixed-capacity ring buffer of one object's recent positions, keyed by
 * absolute sim epoch — brief §F.6 "recent history behind a moving
 * object." Positions are km, the same frame `FrameState.positions`
 * carries (J2000).
 *
 * Read as a **sliding window of the last `capacity` appended samples**,
 * oldest to newest, regardless of which direction sim-time is moving.
 * That is deliberate: `appendIfDue` gates on `|Δepoch|`, so it appends
 * whether the clock is running forward or backward, and eviction always
 * removes the OLDEST insertion. This is what makes reverse playback
 * "retract correctly" (§I M1.7 DoD) without any special-cased reverse
 * logic — the ring is never told which direction it's being fed, and
 * "clear the ring" (brief §F.6) is reserved for genuine discontinuities
 * (`clearTrail`, driven by `scrubGenerationRef`), never for an ordinary
 * rate-sign flip. Immediately after a reversal the ring holds a brief
 * mix of the old forward tail and the new backward one — a real "V" in
 * the drawn line for at most one trail-span's worth of playback — which
 * reads as the trail smoothly changing direction, not as a wipe.
 */
export interface TrailRing {
  readonly capacity: number;
  readonly positions: Float32Array; // capacity * 3, km
  readonly epochs: Float64Array; // capacity, ms since Unix epoch
  count: number; // valid entries currently held, <= capacity
  head: number; // ring index of the oldest valid entry
  lastAppendEpochMs: number; // NaN once empty (fresh or just cleared)
}

/** 10 Hz in sim-time — brief §F.6: "Ring buffer of positions ... appended
 * at 10 Hz simulation time." */
export const TRAIL_APPEND_INTERVAL_MS = 100;

/** 90 s of trail at 10 Hz = 900 points per object — brief §F.6. */
export const TRAIL_CAPACITY = 900;

export function createTrailRing(capacity: number = TRAIL_CAPACITY): TrailRing {
  return {
    capacity,
    positions: new Float32Array(capacity * 3),
    epochs: new Float64Array(capacity),
    count: 0,
    head: 0,
    lastAppendEpochMs: NaN,
  };
}

/** Empties the ring. The next `appendIfDue` call always appends,
 * regardless of how close its epoch is to whatever was last recorded. */
export function clearTrail(ring: TrailRing): void {
  ring.count = 0;
  ring.head = 0;
  ring.lastAppendEpochMs = NaN;
}

/**
 * Append `(x, y, z)` at `epochMs` if the 10 Hz gate allows it. Returns
 * whether it actually appended. Allocation-free; overwrites the oldest
 * slot once the ring is full.
 */
export function appendIfDue(ring: TrailRing, epochMs: number, x: number, y: number, z: number): boolean {
  if (ring.count > 0 && Math.abs(epochMs - ring.lastAppendEpochMs) < TRAIL_APPEND_INTERVAL_MS) {
    return false;
  }
  const full = ring.count >= ring.capacity;
  const writeIndex = full ? ring.head : (ring.head + ring.count) % ring.capacity;
  ring.positions[writeIndex * 3] = x;
  ring.positions[writeIndex * 3 + 1] = y;
  ring.positions[writeIndex * 3 + 2] = z;
  ring.epochs[writeIndex] = epochMs;
  if (full) {
    ring.head = (ring.head + 1) % ring.capacity;
  } else {
    ring.count++;
  }
  ring.lastAppendEpochMs = epochMs;
  return true;
}

/**
 * Copy the ring's contents into `outPositions` (>= `ring.count * 3`
 * floats), oldest first. Returns the count copied. Allocation-free.
 */
export function readOrdered(ring: TrailRing, outPositions: Float32Array): number {
  for (let i = 0; i < ring.count; i++) {
    const src = (ring.head + i) % ring.capacity;
    outPositions[i * 3] = ring.positions[src * 3];
    outPositions[i * 3 + 1] = ring.positions[src * 3 + 1];
    outPositions[i * 3 + 2] = ring.positions[src * 3 + 2];
  }
  return ring.count;
}
