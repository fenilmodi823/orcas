import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
    const { result } = renderHook(() => usePendingView(link, { atMs: null, start }));
    result.current.takeView();
    await act(async () => expect(await result.current.requestView(watch, 500)).toBe(true));
    expect(start).toHaveBeenCalledWith(500);
    expect(result.current.takeView()).toBe(watch);
  });

  it('drops the view when the replay fails, so no later remount applies it', async () => {
    const { result } = renderHook(() => usePendingView(link, { atMs: null, start: vi.fn(async () => false) }));
    result.current.takeView();
    await act(async () => expect(await result.current.requestView(watch, 500)).toBe(false));
    expect(result.current.takeView()).toBeNull();
  });
});
