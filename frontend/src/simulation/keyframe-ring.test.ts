import { describe, expect, it, vi } from 'vitest';
import { createPropagationPool, createInProcessRunner, type PropagationPool } from '../propagation/worker-pool.js';
import { sampleSegment } from '../propagation/segment-builder.js';
import { createEmptyRing, rebuildRing } from './keyframe-ring.js';
import { makeTestCatalog } from './test-fixtures.js';

const { objects, satrecs } = makeTestCatalog(10);
const T0_MS = Date.parse('2026-01-01T00:00:00.000Z');
const T1_MS = T0_MS + 30_000;
const T2_MS = T0_MS + 60_000;

describe('rebuildRing', () => {
  it('keeps the previous ring unchanged when the pool fails — a killed worker never poisons the buffer with NaN', async () => {
    const realPool = createPropagationPool([createInProcessRunner(satrecs)]);
    const flakyPool: PropagationPool = {
      buildSegments: vi
        .fn()
        .mockRejectedValueOnce(new Error('simulated worker death'))
        .mockImplementation(realPool.buildSegments),
      terminate: realPool.terminate,
    };

    const empty = createEmptyRing();
    const afterFailure = await rebuildRing(empty, flakyPool, objects, T0_MS, T1_MS);
    expect(afterFailure.ok).toBe(false);
    expect(afterFailure.ring).toBe(empty); // unchanged, same reference
    expect(afterFailure.ring.segments.size).toBe(0);

    const afterRetry = await rebuildRing(afterFailure.ring, flakyPool, objects, T0_MS, T1_MS);
    expect(afterRetry.ok).toBe(true);
    expect(afterRetry.ring.generation).toBe(empty.generation + 1);
    expect(afterRetry.ring.segments.size).toBe(objects.length);
    for (const segment of afterRetry.ring.segments.values()) {
      expect(Number.isFinite(segment.p0.x)).toBe(true);
      expect(Number.isFinite(segment.v1.z)).toBe(true);
    }
  });

  it('is C¹-continuous across a segment-window boundary — position and velocity match at the shared instant', async () => {
    const pool = createPropagationPool([createInProcessRunner(satrecs)]);
    const first = await rebuildRing(createEmptyRing(), pool, objects, T0_MS, T1_MS);
    const second = await rebuildRing(first.ring, pool, objects, T1_MS, T2_MS);

    const norad = objects[0].norad;
    const endOfFirst = sampleSegment(first.ring.segments.get(norad)!, T1_MS);
    const startOfSecond = sampleSegment(second.ring.segments.get(norad)!, T1_MS);

    const relativeDiff = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(a), 1e-9);
    expect(relativeDiff(endOfFirst.position.x, startOfSecond.position.x)).toBeLessThan(1e-6);
    expect(relativeDiff(endOfFirst.position.y, startOfSecond.position.y)).toBeLessThan(1e-6);
    expect(relativeDiff(endOfFirst.position.z, startOfSecond.position.z)).toBeLessThan(1e-6);
    expect(relativeDiff(endOfFirst.velocity.x, startOfSecond.velocity.x)).toBeLessThan(1e-6);
    expect(relativeDiff(endOfFirst.velocity.y, startOfSecond.velocity.y)).toBeLessThan(1e-6);
    expect(relativeDiff(endOfFirst.velocity.z, startOfSecond.velocity.z)).toBeLessThan(1e-6);
  });
});
