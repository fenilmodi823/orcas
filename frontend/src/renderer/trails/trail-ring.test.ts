import { describe, expect, it } from 'vitest';
import { appendIfDue, clearTrail, createTrailRing, readOrdered, TRAIL_APPEND_INTERVAL_MS } from './trail-ring.js';

describe('trail-ring', () => {
  it('starts empty', () => {
    const ring = createTrailRing(5);
    expect(ring.count).toBe(0);
    const out = new Float32Array(15);
    expect(readOrdered(ring, out)).toBe(0);
  });

  it('always appends the first sample, regardless of epoch', () => {
    const ring = createTrailRing(5);
    expect(appendIfDue(ring, 0, 1, 2, 3)).toBe(true);
    expect(ring.count).toBe(1);
  });

  it('gates on the 10 Hz interval — rejects a sample too close in epoch to the last one', () => {
    const ring = createTrailRing(5);
    appendIfDue(ring, 1_000, 1, 0, 0);
    expect(appendIfDue(ring, 1_000 + TRAIL_APPEND_INTERVAL_MS - 1, 2, 0, 0)).toBe(false);
    expect(ring.count).toBe(1);
    expect(appendIfDue(ring, 1_000 + TRAIL_APPEND_INTERVAL_MS, 2, 0, 0)).toBe(true);
    expect(ring.count).toBe(2);
  });

  it('gates on |delta|, so it appends just as readily moving backward as forward', () => {
    const ring = createTrailRing(5);
    appendIfDue(ring, 1_000, 1, 0, 0);
    expect(appendIfDue(ring, 1_000 - TRAIL_APPEND_INTERVAL_MS, 2, 0, 0)).toBe(true);
    expect(ring.count).toBe(2);
  });

  it('reads back in oldest-to-newest order', () => {
    const ring = createTrailRing(5);
    for (let i = 0; i < 3; i++) appendIfDue(ring, i * TRAIL_APPEND_INTERVAL_MS, i, i * 10, 0);
    const out = new Float32Array(9);
    expect(readOrdered(ring, out)).toBe(3);
    expect([...out]).toEqual([0, 0, 0, 1, 10, 0, 2, 20, 0]);
  });

  it('evicts the oldest sample once full, keeping oldest-to-newest order', () => {
    const ring = createTrailRing(3);
    for (let i = 0; i < 5; i++) appendIfDue(ring, i * TRAIL_APPEND_INTERVAL_MS, i, 0, 0);
    expect(ring.count).toBe(3);
    const out = new Float32Array(9);
    readOrdered(ring, out);
    // Samples 0 and 1 were evicted; 2, 3, 4 remain, oldest first.
    expect([out[0], out[3], out[6]]).toEqual([2, 3, 4]);
  });

  it('clear empties the ring and lifts the append gate', () => {
    const ring = createTrailRing(5);
    appendIfDue(ring, 1_000, 1, 0, 0);
    appendIfDue(ring, 1_000 + TRAIL_APPEND_INTERVAL_MS, 2, 0, 0);
    clearTrail(ring);
    expect(ring.count).toBe(0);
    // Immediately due again, even though the epoch is identical to the
    // last one recorded before the clear.
    expect(appendIfDue(ring, 1_000 + TRAIL_APPEND_INTERVAL_MS, 3, 0, 0)).toBe(true);
    expect(ring.count).toBe(1);
  });

  it('never allocates a new buffer across many appends', () => {
    const ring = createTrailRing(10);
    const positionsRef = ring.positions;
    const epochsRef = ring.epochs;
    for (let i = 0; i < 500; i++) appendIfDue(ring, i * TRAIL_APPEND_INTERVAL_MS, i, i, i);
    expect(ring.positions).toBe(positionsRef);
    expect(ring.epochs).toBe(epochsRef);
  });
});
