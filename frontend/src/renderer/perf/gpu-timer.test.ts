import { describe, expect, it } from 'vitest';
import { createGpuTimer, type GpuQueryContext } from './gpu-timer.js';

/** A fake GPU: queries "complete" (become available) after N polls, and
 * report a fixed elapsed time. No real WebGL context involved. */
function fakeGpu(resultNs: number, framesToResolve: number, disjoint = false) {
  let nextId = 0;
  const pollCounts = new Map<object, number>();
  const deleted = new Set<object>();
  const ctx: GpuQueryContext = {
    createQuery: () => ({ id: nextId++ }),
    beginQuery: () => {},
    endQuery: () => {},
    isResultAvailable: (query) => {
      const n = (pollCounts.get(query) ?? 0) + 1;
      pollCounts.set(query, n);
      return n >= framesToResolve;
    },
    isDisjoint: () => disjoint,
    getResultNs: () => resultNs,
    deleteQuery: (query) => deleted.add(query),
  };
  return { ctx, deleted };
}

describe('createGpuTimer', () => {
  it('reports no sample until the query actually resolves', () => {
    const { ctx } = fakeGpu(5_000_000, 3);
    const timer = createGpuTimer(ctx);
    timer.begin();
    timer.end();
    expect(timer.poll()).toBeNull();
    expect(timer.poll()).toBeNull();
    expect(timer.poll()).toBeCloseTo(5, 5); // 5,000,000 ns = 5 ms, ready on the 3rd poll
  });

  it('converts nanoseconds to milliseconds', () => {
    const { ctx } = fakeGpu(16_670_000, 1);
    const timer = createGpuTimer(ctx);
    timer.begin();
    timer.end();
    expect(timer.poll()).toBeCloseTo(16.67, 2);
  });

  it('drops a disjoint sample instead of reporting garbage timing', () => {
    const { ctx } = fakeGpu(9_000_000, 1, true);
    const timer = createGpuTimer(ctx);
    timer.begin();
    timer.end();
    expect(timer.poll()).toBeNull();
  });

  it('ignores a nested begin() while a query is already open', () => {
    const { ctx } = fakeGpu(1_000_000, 1);
    const timer = createGpuTimer(ctx);
    timer.begin();
    timer.begin(); // should be a no-op — only one query per begin/end pair
    timer.end();
    expect(timer.poll()).toBeCloseTo(1, 5);
    expect(timer.poll()).toBeNull(); // nothing else pending
  });

  it('evicts the oldest pending query once the queue exceeds its cap, deleting it', () => {
    const { ctx, deleted } = fakeGpu(1_000_000, 100); // never resolves within the test
    const timer = createGpuTimer(ctx);
    const queries: object[] = [];
    const originalCreate = ctx.createQuery.bind(ctx);
    ctx.createQuery = () => {
      const q = originalCreate();
      if (q) queries.push(q);
      return q;
    };
    for (let i = 0; i < 6; i++) {
      timer.begin();
      timer.end();
    }
    expect(deleted.has(queries[0])).toBe(true); // oldest evicted
    expect(deleted.has(queries[5])).toBe(false); // newest kept
  });
});
