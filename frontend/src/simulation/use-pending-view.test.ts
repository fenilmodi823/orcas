import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useApplyInitialView } from './use-view-url.js';
import { usePendingView, type PendingView } from './use-pending-view.js';

const link: PendingView = { epochMs: 1, rate: null, paused: false, selected: '25544' };
const watch: PendingView = { epochMs: 2, rate: 1, paused: false, selected: '53252' };

describe('usePendingView', () => {
  it('hands the startup link out once', () => {
    const { result } = renderHook(() => usePendingView(link, { atMs: null, start: vi.fn() }));
    expect(result.current.takeView()).toBe(link);
    expect(result.current.takeView()).toBeNull();
  });

  it('applies in place when already replaying that instant: no new replay, the request count moves', async () => {
    const start = vi.fn(async () => true);
    const { result } = renderHook(() => usePendingView(link, { atMs: 500, start }));
    result.current.takeView();
    await act(async () => expect(await result.current.requestView(watch, 500)).toBe(true));
    expect(start).not.toHaveBeenCalled();
    expect(result.current.viewRequest).toBe(1);
    expect(result.current.takeView()).toBe(watch);
  });

  it('starts the replay otherwise, and keeps the view for the remount', async () => {
    const start = vi.fn(async () => true);
    const { result, rerender } = renderHook(({ atMs }) => usePendingView(link, { atMs, start }), { initialProps: { atMs: null as number | null } });
    result.current.takeView();
    await act(async () => expect(await result.current.requestView(watch, 500)).toBe(true));
    expect(start).toHaveBeenCalledWith(500);
    rerender({ atMs: 500 }); // the replay landed and the scene remounted
    expect(result.current.takeView()).toBe(watch);
  });

  it('drops the view when the replay fails, so no later remount applies it', async () => {
    const { result } = renderHook(() => usePendingView(link, { atMs: null, start: vi.fn(async () => false) }));
    result.current.takeView();
    await act(async () => expect(await result.current.requestView(watch, 500)).toBe(false));
    expect(result.current.takeView()).toBeNull();
  });

  it('hands a view only to a scene at the replay instant it was requested for, and keeps it for that scene', async () => {
    const start = vi.fn(() => new Promise<boolean>(() => undefined));
    const { result, rerender } = renderHook(({ atMs }) => usePendingView(link, { atMs, start }), { initialProps: { atMs: null as number | null } });
    result.current.takeView();
    void act(() => void result.current.requestView(watch, 500));
    expect(result.current.takeView()).toBeNull(); // the pre-replay scene
    expect(result.current.takeView()).toBeNull(); // asking again does not clear it
    rerender({ atMs: 500 });
    expect(result.current.takeView()).toBe(watch); // the replay's scene
  });

  it('does not apply a pending view to the old scene when jumpTo changes during the fetch', () => {
    const start = vi.fn(() => new Promise<boolean>(() => undefined));
    const select = vi.fn();
    const jumpTo = vi.fn();
    const { result, rerender } = renderHook(
      ({ jump }) => {
        const pending = usePendingView(link, { atMs: null, start });
        useApplyInitialView(pending.takeView, { select, jumpTo: jump }, pending.viewRequest);
        return pending;
      },
      { initialProps: { jump: jumpTo } },
    );
    select.mockClear();
    jumpTo.mockClear();
    void act(() => void result.current.requestView(watch, 500));
    rerender({ jump: vi.fn((ms: number) => jumpTo(ms)) });
    expect(select).not.toHaveBeenCalled();
    expect(jumpTo).not.toHaveBeenCalled();
  });
});
