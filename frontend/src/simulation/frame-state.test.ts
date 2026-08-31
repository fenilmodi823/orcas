import { describe, expect, it } from 'vitest';
import { createPropagationPool, createInProcessRunner } from '../propagation/worker-pool.js';
import { rebuildRing, createEmptyRing } from './keyframe-ring.js';
import { createFrameState, evaluateFrame, Flag } from './frame-state.js';
import { makeTestCatalog } from './test-fixtures.js';

const { objects, satrecs } = makeTestCatalog(10);
const T0_MS = Date.parse('2026-01-01T00:00:00.000Z');
const T1_MS = T0_MS + 60_000;

async function buildTestRing() {
  const pool = createPropagationPool([createInProcessRunner(satrecs)]);
  const result = await rebuildRing(createEmptyRing(), pool, objects, T0_MS, T1_MS);
  return result.ring;
}

describe('evaluateFrame', () => {
  it('never reallocates its buffers across 600 evaluations — DoD: zero allocations after warm-up', async () => {
    const ring = await buildTestRing();
    const frameState = createFrameState(objects.length);
    const positionsRef = frameState.positions;
    const velocitiesRef = frameState.velocities;
    const flagsRef = frameState.flags;

    for (let i = 0; i < 600; i++) {
      const result = evaluateFrame(frameState, ring, objects, T0_MS + i * 100);
      expect(result).toBe(frameState);
      expect(result.positions).toBe(positionsRef);
      expect(result.velocities).toBe(velocitiesRef);
      expect(result.flags).toBe(flagsRef);
    }
  });

  it('is a pure function of (ring, objects, epoch) — two independent buffers at the same epoch are bit-identical', async () => {
    const ring = await buildTestRing();
    const a = evaluateFrame(createFrameState(objects.length), ring, objects, T0_MS + 12_345);
    const b = evaluateFrame(createFrameState(objects.length), ring, objects, T0_MS + 12_345);
    expect(a.positions).toEqual(b.positions);
    expect(a.velocities).toEqual(b.velocities);
    expect(a.flags).toEqual(b.flags);
  });

  // The enum's value changed in M1.7a (1 << 0 -> 1 << 2). A test that only
  // checks the constants would not catch evaluateFrame writing one bit while
  // a consumer reads another, so pin the round trip through the real path.
  it('still flags an uncovered object Stale after the M1.7a renumbering', () => {
    // `Flag` is a const enum, so an assertion against `Flag.Stale` is inlined
    // at compile time and would pass whatever the bit is. Assert the literal.
    const result = evaluateFrame(createFrameState(objects.length), createEmptyRing(), objects, T0_MS);
    expect(result.flags[0]).toBe(4); // 1 << 2, the brief's bit — not 1
  });

  it('clears Stale when a segment does cover the epoch', async () => {
    const ring = await buildTestRing();
    const frameState = createFrameState(objects.length);
    const result = evaluateFrame(frameState, ring, objects, T0_MS);
    expect(result.flags[0] & Flag.Stale).toBe(0);
  });

  it('flags an object Stale, never NaN, when no segment covers it yet', async () => {
    const frameState = createFrameState(objects.length);
    evaluateFrame(frameState, createEmptyRing(), objects, T0_MS);
    for (let i = 0; i < objects.length; i++) {
      expect(frameState.flags[i]).toBe(Flag.Stale);
      expect(Number.isNaN(frameState.positions[i * 3])).toBe(false);
    }
  });
});
