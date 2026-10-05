import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSimulationStore } from '../state/simulation-store.js';
import { useEdgeStop } from './use-edge-stop.js';

const RANGE = { startMs: Date.UTC(2026, 8, 26), endMs: Date.UTC(2026, 9, 12) };

beforeEach(() => {
  useSimulationStore.setState({ playing: true, rate: 1, reversed: false, edgeNotice: null });
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('useEdgeStop (S1: stop at the edge of the data and say so)', () => {
  it('stops playback that runs past the end, pulls it back to the edge and says why', () => {
    const scrubTo = vi.fn();
    const { result } = renderHook(() => useEdgeStop(RANGE.endMs + 60_000, true, RANGE, scrubTo));

    expect(useSimulationStore.getState().playing).toBe(false);
    expect(scrubTo).toHaveBeenCalledWith(RANGE.endMs);
    expect(result.current.notice).toMatch(/no element set covers a later time/);
  });

  it('jumps to a typed time and pauses there, as NASA Eyes does', () => {
    const scrubTo = vi.fn();
    const { result } = renderHook(() => useEdgeStop(RANGE.startMs + 1, false, RANGE, scrubTo));
    const target = Date.UTC(2026, 9, 5);

    act(() => result.current.jumpTo(target));
    expect(scrubTo).toHaveBeenCalledWith(target);
    expect(useSimulationStore.getState().playing).toBe(false);
    expect(result.current.notice).toBeNull();
  });

  it('clamps a typed time outside the data to the edge, and says so', () => {
    const scrubTo = vi.fn();
    const { result } = renderHook(() => useEdgeStop(RANGE.startMs + 1, false, RANGE, scrubTo));

    act(() => result.current.jumpTo(Date.UTC(2020, 0, 1)));
    expect(scrubTo).toHaveBeenCalledWith(RANGE.startMs);
    expect(result.current.notice).toMatch(/covers an earlier time/);
  });

  it('lets the notice go after a few seconds', () => {
    const scrubTo = vi.fn(); // stable, as the dock's is (useCallback)
    const { result } = renderHook(() => useEdgeStop(RANGE.endMs + 60_000, true, RANGE, scrubTo));
    expect(result.current.notice).not.toBeNull();
    act(() => vi.advanceTimersByTime(10_000));
    expect(result.current.notice).toBeNull();
  });
});
