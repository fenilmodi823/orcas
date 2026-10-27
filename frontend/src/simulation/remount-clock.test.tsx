import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSimulationStore } from '../state/simulation-store.js';
import { createFrameState } from './frame-state.js';
import { useSimulationClock } from './use-simulation-clock.js';
import { useEdgeStop } from './use-edge-stop.js';
import { useApplyInitialView } from './use-view-url.js';

// A range that ends before today: the live catalogue's replay range.
const RANGE = { startMs: Date.UTC(2026, 8, 26), endMs: Date.UTC(2026, 9, 12) };
const VIEW_MS = Date.UTC(2026, 9, 5, 12);

beforeEach(() => {
  useSimulationStore.setState({ playing: false, rate: 1, reversed: false, edgeNotice: null });
});
afterEach(() => vi.useRealTimers());

describe('the dock after a replay remount (Q16)', () => {
  it('keeps the view epoch the Watch jump set, not the replay range end', () => {
    const scrubTo = vi.fn();
    const loop = { frameStateRef: { current: createFrameState(0) }, startEpochMs: VIEW_MS - 30_000 }; // epochMs 0: no sample yet
    const view = { epochMs: VIEW_MS, rate: 1, paused: false, selected: null };
    const take = vi.fn().mockReturnValueOnce(view).mockReturnValue(null);

    renderHook(() => {
      const now = useSimulationClock(loop);
      const playing = useSimulationStore((s) => s.playing);
      const edge = useEdgeStop(now.getTime(), playing, RANGE, scrubTo);
      useApplyInitialView(take, { select: vi.fn(), jumpTo: edge.jumpTo });
      return edge;
    });

    expect(scrubTo).toHaveBeenLastCalledWith(VIEW_MS);
    expect(scrubTo).not.toHaveBeenCalledWith(RANGE.endMs);
    expect(useSimulationStore.getState().edgeNotice).toBeNull();
    expect(useSimulationStore.getState().playing).toBe(true);
  });
});
