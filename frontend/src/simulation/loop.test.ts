import { describe, expect, it } from 'vitest';
import { createPropagationPool, createInProcessRunner } from '../propagation/worker-pool.js';
import { rebuildRing, createEmptyRing } from './keyframe-ring.js';
import { createFrameState, evaluateFrame } from './frame-state.js';
import { epochMsToTicks } from '../time/clock.js';
import { stepClock } from './loop.js';
import { makeTestCatalog } from './test-fixtures.js';

const { objects, satrecs } = makeTestCatalog(10);
const T0_MS = Date.parse('2026-01-01T00:00:00.000Z');

async function buildTestRing(t0Ms: number, t1Ms: number) {
  const pool = createPropagationPool([createInProcessRunner(satrecs)]);
  const result = await rebuildRing(createEmptyRing(), pool, objects, t0Ms, t1Ms);
  return result.ring;
}

describe('stepClock', () => {
  it('flags needsRebuild only once the epoch leaves the ring window', async () => {
    const ring = await buildTestRing(T0_MS, T0_MS + 60_000);
    const insideTicks = epochMsToTicks(T0_MS + 30_000);
    const inside = stepClock(insideTicks, 0, 0, ring);
    expect(inside.needsRebuild).toBe(false);

    const nearEndTicks = epochMsToTicks(T0_MS + 59_000);
    const leaving = stepClock(nearEndTicks, 2_000, 1, ring);
    expect(leaving.needsRebuild).toBe(true);
  });

  it('scrubbing directly to an epoch matches reaching it by incremental play — brief §I M1.2 "Scrub equivalence"', async () => {
    const ring = await buildTestRing(T0_MS, T0_MS + 60_000);

    const direct = evaluateFrame(createFrameState(objects.length), ring, objects, T0_MS + 45_000);

    let ticks = epochMsToTicks(T0_MS);
    const stepped = createFrameState(objects.length);
    const dtMs = 1000;
    for (let t = T0_MS; t < T0_MS + 45_000; t += dtMs) {
      const result = stepClock(ticks, dtMs, 1, ring);
      ticks = result.clockTicks;
      evaluateFrame(stepped, ring, objects, result.epochMs);
    }

    expect(stepped.epochMs).toBe(direct.epochMs);
    expect(stepped.positions).toEqual(direct.positions);
    expect(stepped.velocities).toEqual(direct.velocities);
  });
});
