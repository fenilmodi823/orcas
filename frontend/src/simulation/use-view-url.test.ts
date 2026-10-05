import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSimulationStore } from '../state/simulation-store.js';
import { useApplyInitialView, useWriteViewUrl } from './use-view-url.js';

const T = Date.UTC(2026, 9, 5);

beforeEach(() => {
  vi.useFakeTimers();
  useSimulationStore.setState({ playing: true, rate: 1, reversed: false, live: true });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useWriteViewUrl', () => {
  it('writes the view into the address, without adding history entries', () => {
    const replace = vi.spyOn(window.history, 'replaceState');
    renderHook(() => useWriteViewUrl({ epochMs: T, rate: 3600, playing: true, live: false, selected: '25544' }));
    vi.advanceTimersByTime(1_000);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(String(replace.mock.calls[0][2])).toContain('t=2026-10-05T00%3A00%3A00Z');
    expect(String(replace.mock.calls[0][2])).toContain('object=25544');
  });

  it('writes at most once a second (Safari throws past 100 calls in 30 s), and the last change lands', () => {
    const writtenAt: number[] = [];
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => writtenAt.push(Date.now()));
    const { rerender } = renderHook((epochMs: number) => useWriteViewUrl({ epochMs, rate: 3600, playing: true, live: false, selected: null }), {
      initialProps: T,
    });
    for (let i = 1; i <= 12; i++) {
      rerender(T + i * 900_000); // the dock ticks four times a second while playing
      vi.advanceTimersByTime(250);
    }
    vi.advanceTimersByTime(1_000);
    for (let i = 1; i < writtenAt.length; i++) expect(writtenAt[i] - writtenAt[i - 1]).toBeGreaterThanOrEqual(1_000);
    expect(writtenAt.length).toBeGreaterThanOrEqual(3);
    expect(window.history.replaceState).toHaveBeenLastCalledWith(null, '', expect.stringContaining('t=2026-10-05T03%3A00%3A00Z'));
  });
});

describe('useWriteViewUrl when live', () => {
  it('leaves time and rate out while live, so the link opens the present', () => {
    const replace = vi.spyOn(window.history, 'replaceState');
    // Live is intent, not clock lag: a throttled tab lets the simulated clock
    // fall behind the wall clock without anyone having moved time.
    renderHook(() => useWriteViewUrl({ epochMs: T - 3_600_000, rate: 1, playing: true, live: true, selected: '25544' }));
    vi.advanceTimersByTime(1_000);
    const params = new URLSearchParams(String(replace.mock.calls[0][2]).slice(1));
    expect(params.has('t')).toBe(false);
    expect(params.has('rate')).toBe(false);
    expect(params.get('object')).toBe('25544');
  });
});

describe('useApplyInitialView', () => {
  it('applies a link once: selection, rate, then time', () => {
    const select = vi.fn();
    const jumpTo = vi.fn();
    const take = vi.fn().mockReturnValueOnce({ epochMs: T, rate: -3600, paused: false, selected: '25544' }).mockReturnValue(null);

    const { rerender } = renderHook(() => useApplyInitialView(take, { select, jumpTo }));
    rerender();

    expect(select).toHaveBeenCalledWith('25544');
    expect(jumpTo).toHaveBeenCalledWith(T);
    expect(useSimulationStore.getState().playing).toBe(true); // a link with a rate keeps playing
    expect(useSimulationStore.getState().reversed).toBe(true);
    expect(useSimulationStore.getState().rate).toBe(3600);
    expect(select).toHaveBeenCalledTimes(1);
  });

  it('a link with a rate but no time is no longer live, so the rate survives the next write', () => {
    const take = vi.fn().mockReturnValueOnce({ epochMs: null, rate: 3600, paused: false, selected: null });
    renderHook(() => useApplyInitialView(take, { select: vi.fn(), jumpTo: vi.fn() }));
    expect(useSimulationStore.getState().live).toBe(false);
  });

  it('opens paused when the link says rate 0', () => {
    const take = vi.fn().mockReturnValueOnce({ epochMs: T, rate: null, paused: true, selected: null });
    renderHook(() => useApplyInitialView(take, { select: vi.fn(), jumpTo: vi.fn() }));
    expect(useSimulationStore.getState().playing).toBe(false);
  });
});
