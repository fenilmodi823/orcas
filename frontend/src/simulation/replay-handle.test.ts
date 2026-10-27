import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSelectionStore, type WatchPair } from '../state/selection-store.js';
import type { NoradId } from '../data/catalog-types.js';
import { toReplayHandle } from './replay-handle.js';
import { usePendingView } from './use-pending-view.js';

const pair: WatchPair = { follow: '1' as NoradId, counterpart: '2' as NoradId };
beforeEach(() => useSelectionStore.setState({ selectedNorad: null, watchPair: pair }));

describe('toReplayHandle', () => {
  it('a manual replay start clears the Watch pair; leaving the replay does too', async () => {
    const start = vi.fn(async () => true);
    const end = vi.fn();
    const handle = toReplayHandle({ atMs: null, error: null, start, end });
    await handle.start(5);
    expect(start).toHaveBeenCalledWith(5);
    expect(useSelectionStore.getState().watchPair).toBeNull();
    useSelectionStore.setState({ watchPair: pair });
    handle.end();
    expect(end).toHaveBeenCalled();
    expect(useSelectionStore.getState().watchPair).toBeNull();
  });

  it("Watch's own replay (through the pending view, on the raw start) leaves the pair", async () => {
    const start = vi.fn(async () => true);
    const { result } = renderHook(() => usePendingView({ epochMs: 1, rate: null, paused: false, selected: null }, { atMs: null, start }));
    await result.current.requestView({ epochMs: 2, rate: 1, paused: false, selected: '1' }, 500);
    expect(start).toHaveBeenCalledWith(500);
    expect(useSelectionStore.getState().watchPair).toBe(pair);
  });
});
