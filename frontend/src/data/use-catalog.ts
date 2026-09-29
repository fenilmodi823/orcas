import { useCallback, useEffect, useState } from 'react';
import { fetchCatalogReplay, fetchCatalogSnapshot } from './catalog-client.js';
import { loadPersistedSnapshot, persistSnapshot } from './catalog-db.js';
import { buildSnapshot } from './catalog-snapshot.js';
import { fallbackRecords } from './fallback-snapshot.js';
import type { CatalogSnapshot } from './catalog-types.js';

export type CatalogOrigin = 'live' | 'cached' | 'bundled' | 'replay' | 'unavailable';

export interface CatalogState {
  readonly snapshot: CatalogSnapshot | null;
  readonly origin: CatalogOrigin;
  readonly loading: boolean;
  readonly error: string | null;
  /** The instant a historical replay shows, or null for the present. */
  readonly replayAtMs: number | null;
  /** Why the last replay request failed, in the backend's words. */
  readonly replayError: string | null;
}

export interface CatalogHandle extends CatalogState {
  /** Load the catalogue as it stood at `atMs`. On failure what is on screen stays. */
  readonly startReplay: (atMs: number) => Promise<void>;
  /** Leave replay and load the live catalogue again. */
  readonly endReplay: () => void;
}

const LOADING: CatalogState = {
  snapshot: null,
  origin: 'unavailable',
  loading: true,
  error: null,
  replayAtMs: null,
  replayError: null,
};

async function loadLive(): Promise<CatalogState> {
  const base = { loading: false, error: null, replayAtMs: null, replayError: null };
  try {
    const records = await fetchCatalogSnapshot();
    const snapshot = buildSnapshot(records, Date.now());
    void persistSnapshot(snapshot);
    return { ...base, snapshot, origin: 'live' };
  } catch (liveErr) {
    const cached = await loadPersistedSnapshot();
    if (cached) return { ...base, snapshot: cached, origin: 'cached' };
    // Last resort (Rules.md §4: never blank): the 21 bundled fixtures,
    // never persisted — this is a stand-in, not a real snapshot worth
    // overwriting a genuine cached one with on a later visit.
    try {
      return { ...base, snapshot: buildSnapshot(fallbackRecords, Date.now()), origin: 'bundled' };
    } catch {
      const error = liveErr instanceof Error ? liveErr.message : String(liveErr);
      return { ...base, snapshot: null, origin: 'unavailable', error };
    }
  }
}

/**
 * Loads the catalogue on mount: try a live fetch first, validate and
 * persist it; on failure, fall back to whatever was last persisted to
 * IndexedDB; if even that's empty (a fresh clone, a cleared browser),
 * fall back again to the bundled sample fixtures rather than showing
 * nothing. Matches Rules.md's error-handling table: "Backend unreachable
 * -> scene runs from the static snapshot, visible 'data may be stale'
 * pill, never blank." `origin` tells the caller which path served the
 * current snapshot, so the UI can be honest about it — it's fetch-session
 * provenance, not part of the snapshot's own data, so it lives in this
 * hook's state rather than in CatalogSnapshot itself.
 *
 * Historical replay (Phase 5) swaps in the catalogue as it stood at a past
 * instant. Its records are validated against that instant, not against
 * today, and it is never persisted — a replay is not the latest data.
 */
export function useCatalog(): CatalogHandle {
  const [state, setState] = useState<CatalogState>(LOADING);
  const [liveRequest, setLiveRequest] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void loadLive().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [liveRequest]);

  const startReplay = useCallback(async (atMs: number) => {
    try {
      const records = await fetchCatalogReplay(atMs);
      const snapshot = buildSnapshot(records, atMs, Date.now());
      setState({ snapshot, origin: 'replay', loading: false, error: null, replayAtMs: atMs, replayError: null });
    } catch (err) {
      const replayError = err instanceof Error ? err.message : String(err);
      setState((prev) => ({ ...prev, replayError }));
    }
  }, []);

  const endReplay = useCallback(() => {
    setState(LOADING);
    setLiveRequest((n) => n + 1);
  }, []);

  return { ...state, startReplay, endReplay };
}
