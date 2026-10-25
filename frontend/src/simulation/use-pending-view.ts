import { useCallback, useRef, useState } from 'react';
import type { parseViewState } from './view-url.js';

export type PendingView = ReturnType<typeof parseViewState>;

/**
 * The view the scene applies once after it mounts: first the link the page
 * opened with, then any Watch or Go there (conjunction-alert spec §3.5). A
 * replay remounts the scene, so the view waits here; already in the right
 * replay, the request count moves instead and the dock applies it in place.
 */
export function usePendingView(
  initialView: PendingView,
  replay: { readonly atMs: number | null; readonly start: (atMs: number) => Promise<boolean> },
): { takeView: () => PendingView | null; requestView: (view: PendingView, replayAtMs: number) => Promise<boolean>; viewRequest: number } {
  const pendingRef = useRef<PendingView | null>(initialView);
  const [viewRequest, setViewRequest] = useState(0);
  const takeView = useCallback(() => {
    const view = pendingRef.current;
    pendingRef.current = null;
    return view;
  }, []);
  const { atMs, start } = replay;
  const requestView = useCallback(
    async (view: PendingView, replayAtMs: number) => {
      pendingRef.current = view;
      if (atMs === replayAtMs) {
        setViewRequest((n) => n + 1);
        return true;
      }
      const ok = await start(replayAtMs);
      if (!ok) pendingRef.current = null; // never let a later, unrelated remount apply it
      return ok;
    },
    [atMs, start],
  );
  return { takeView, requestView, viewRequest };
}
