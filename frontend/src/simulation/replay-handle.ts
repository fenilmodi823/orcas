import { useSelectionStore } from '../state/selection-store.js';
import type { ReplayHandle } from '../ui/ReplayControl.js';

/**
 * The replay control's handle. Starting a replay by hand or leaving one ends
 * Watch's pin (spec §4); Watch's own replay goes through `usePendingView` on
 * the raw `start`, so it keeps the pair it just set.
 */
export function toReplayHandle(replay: ReplayHandle): ReplayHandle {
  const clearPair = () => useSelectionStore.getState().setWatchPair(null);
  return {
    ...replay,
    start: (atMs) => {
      clearPair();
      return replay.start(atMs);
    },
    end: () => {
      clearPair();
      replay.end();
    },
  };
}
