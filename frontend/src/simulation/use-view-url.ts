import { useEffect, useRef } from 'react';
import { useSimulationStore } from '../state/simulation-store.js';
import { encodeViewState, type parseViewState } from './view-url.js';

/** Safari throws after 100 `replaceState` calls in 30 s; the dock ticks at 4 Hz. */
const WRITE_INTERVAL_MS = 1_000;

/**
 * Keeps the address bar describing the view (S1, NASA Eyes' shareable links),
 * replacing rather than pushing, so the back button is not flooded. Writes
 * are throttled to one a second and always land: a change inside the window
 * is written when it closes.
 */
export function useWriteViewUrl(state: {
  epochMs: number;
  rate: number;
  playing: boolean;
  /** The store's `live`: a live view leaves time out, so the link opens now. */
  live: boolean;
  selected: string | null;
}): void {
  const lastWriteMsRef = useRef(Number.NEGATIVE_INFINITY);
  const lastSearchRef = useRef<string | null>(null);
  const { epochMs, rate, playing, live, selected } = state;

  useEffect(() => {
    const delayMs = Math.max(0, WRITE_INTERVAL_MS - (Date.now() - lastWriteMsRef.current));
    const timer = setTimeout(() => {
      const view = { epochMs: live && playing ? null : epochMs, rate, playing, selected };
      const search = encodeViewState(new URLSearchParams(window.location.search), view).toString();
      if (search === lastSearchRef.current) return;
      window.history.replaceState(null, '', search ? `?${search}` : window.location.pathname);
      lastSearchRef.current = search;
      lastWriteMsRef.current = Date.now();
    }, delayMs);
    return () => clearTimeout(timer);
  }, [epochMs, rate, playing, live, selected]);
}

type InitialView = ReturnType<typeof parseViewState>;

/**
 * Applies the link the page was opened with, once: the selection, then the
 * time (which pauses), then the rate — a link that carries a rate plays at it,
 * `rate=0` opens paused. `take` returns the view the first time and null after,
 * so a remount (a replay) never re-applies an old link.
 */
export function useApplyInitialView(
  take: () => InitialView | null,
  actions: { select: (id: string) => void; jumpTo: (epochMs: number) => void },
): void {
  const { select, jumpTo } = actions;
  useEffect(() => {
    const view = take();
    if (!view) return;
    const store = useSimulationStore.getState();
    if (view.selected !== null) select(view.selected);
    if (view.epochMs !== null) {
      jumpTo(view.epochMs);
      store.leaveLive();
    }
    if (view.rate !== null) {
      useSimulationStore.setState({ rate: Math.abs(view.rate), reversed: view.rate < 0 });
      store.play();
      if (view.rate !== 1) store.leaveLive(); // a chosen rate is a hand on the clock
    } else if (view.paused) {
      store.pause();
    }
  }, [take, select, jumpTo]);
}
