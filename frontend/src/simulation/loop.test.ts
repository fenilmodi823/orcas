import { describe, expect, it } from 'vitest';
import { createPropagationPool, createInProcessRunner } from '../propagation/worker-pool.js';
import { rebuildRing, createEmptyRing } from './keyframe-ring.js';
import { createFrameState, evaluateFrame } from './frame-state.js';
import { epochMsToTicks } from '../time/clock.js';
import { REVERSE_LEAD_MS, rebuildWindowFor, stepClock } from './loop.js';
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

describe('rebuildWindowFor — reversibility (brief §I M1.2)', () => {
  const WINDOW = 30_000;
  const E = T0_MS + 100_000;
  // A rebuild is asynchronous: by the time it lands the clock has moved on.
  // Two seconds of travel is generous for a worker rebuild of the window.
  const TRAVEL_MS = 2_000;

  it('keeps the forward window exactly as it was', () => {
    expect(rebuildWindowFor(E, 1, WINDOW)).toEqual({ t0Ms: E, t1Ms: E + WINDOW });
    expect(rebuildWindowFor(E, 0, WINDOW)).toEqual({ t0Ms: E, t1Ms: E + WINDOW });
  });

  it('builds the reverse window behind the clock, with a lead past the epoch', () => {
    expect(rebuildWindowFor(E, -10, WINDOW)).toEqual({ t0Ms: E - WINDOW, t1Ms: E + REVERSE_LEAD_MS });
  });

  it('still covers the clock after it has run backwards during the rebuild', async () => {
    const { t0Ms, t1Ms } = rebuildWindowFor(E, -1, WINDOW);
    const ring = await buildTestRing(t0Ms, t1Ms);

    const result = stepClock(epochMsToTicks(E), TRAVEL_MS, -1, ring);

    expect(result.epochMs).toBe(E - TRAVEL_MS);
    expect(result.needsRebuild).toBe(false);
  });

  it('shows why: a forward-only window is already behind a reversing clock', async () => {
    // The old behaviour, kept as the regression it guards against.
    const ring = await buildTestRing(E, E + WINDOW);

    expect(stepClock(epochMsToTicks(E), TRAVEL_MS, -1, ring).needsRebuild).toBe(true);
  });

  it('evaluates real positions in reverse rather than flagging everything stale', async () => {
    const { t0Ms, t1Ms } = rebuildWindowFor(E, -1, WINDOW);
    const ring = await buildTestRing(t0Ms, t1Ms);

    const frame = evaluateFrame(createFrameState(objects.length), ring, objects, E - TRAVEL_MS);

    expect(frame.epochMs).toBe(E - TRAVEL_MS);
    expect(Array.from(frame.positions).some((v) => v !== 0)).toBe(true);
  });
});

