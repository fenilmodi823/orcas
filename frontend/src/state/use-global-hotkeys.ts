import { useEffect } from 'react';
import { useSelectionStore } from './selection-store.js';
import { useSimulationStore } from './simulation-store.js';
import { useViewStore } from './view-store.js';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

/**
 * App-wide keyboard shortcuts (Design.md §9): Escape deselects and releases
 * the camera, Space toggles playback, `/` summons search (Design.md §7: search
 * is summoned, never on screen at rest). Reads store state via
 * `getState()` — this hook only dispatches actions, it never needs to
 * re-render on state change.
 */
export function useGlobalHotkeys() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;

      if (event.key === 'Escape') {
        useSelectionStore.getState().setSelected(null);
      } else if (event.key === '/') {
        event.preventDefault();
        useViewStore.getState().openSearch();
      } else if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault();
        useSimulationStore.getState().togglePlaying();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
