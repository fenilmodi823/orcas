import { useCallback, useRef, useState } from 'react';
import type { parseViewState } from './view-url.js';

export type PendingView = ReturnType<typeof parseViewState>;

/**
 * The view the scene applies once after it mounts: first the link the page
 * opened with, then any Watch or Go there (conjunction-alert spec §3.5). A
 * replay remounts the scene, so the view waits here; already in the right
 * replay, the request count moves instead and the dock applies it in place.
 * A view is handed only to a scene at the replay instant it was requested
 * for, so a re-render of the old scene during the fetch cannot take it.
 */
export function usePendingView(
  initialView: PendingView,
  replay: { readonly atMs: number | null; readonly start: (atMs: number) => Promise<boolean> },
): { takeView: () => PendingView | null; requestView: (view: PendingView, replayAtMs: number) => Promise<boolean>; viewRequest: number } {
  const { atMs, start } = replay;
  const pendingRef = useRef<{ view: PendingView; replayAtMs: number | null } | null>({ view: initialView, replayAtMs: atMs });
  const [viewRequest, setViewRequest] = useState(0);
  const takeView = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending || pending.replayAtMs !== atMs) return null; // not this scene's: leave it waiting
    pendingRef.current = null;
    return pending.view;
  }, [atMs]);
  const requestView = useCallback(
    async (view: PendingView, replayAtMs: number) => {
      pendingRef.current = { view, replayAtMs };
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
