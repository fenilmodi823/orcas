import { useEffect, useState } from 'react';
import { fetchCatalogSnapshot } from './catalog-client.js';
import { loadPersistedSnapshot, persistSnapshot } from './catalog-db.js';
import { buildSnapshot } from './catalog-snapshot.js';
import { fallbackRecords } from './fallback-snapshot.js';
import type { CatalogSnapshot } from './catalog-types.js';

export type CatalogOrigin = 'live' | 'cached' | 'bundled' | 'unavailable';

export interface CatalogState {
  readonly snapshot: CatalogSnapshot | null;
  readonly origin: CatalogOrigin;
  readonly loading: boolean;
  readonly error: string | null;
}

/**
 * Loads the catalogue once on mount: try a live fetch first, validate and
 * persist it; on failure, fall back to whatever was last persisted to
 * IndexedDB; if even that's empty (a fresh clone, a cleared browser),
 * fall back again to the bundled sample fixtures rather than showing
 * nothing. Matches Rules.md's error-handling table: "Backend unreachable
 * -> scene runs from the static snapshot, visible 'data may be stale'
 * pill, never blank." `origin` tells the caller which path served the
 * current snapshot, so the UI can be honest about it — it's fetch-session
 * provenance, not part of the snapshot's own data, so it lives in this
 * hook's state rather than in CatalogSnapshot itself.
 */
export function useCatalog(): CatalogState {
  const [state, setState] = useState<CatalogState>({
    snapshot: null,
    origin: 'unavailable',
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const records = await fetchCatalogSnapshot();
        if (cancelled) return;
        const snapshot = buildSnapshot(records, Date.now());
        setState({ snapshot, origin: 'live', loading: false, error: null });
        void persistSnapshot(snapshot);
      } catch (liveErr) {
        const cached = await loadPersistedSnapshot();
        if (cancelled) return;
        if (cached) {
          setState({ snapshot: cached, origin: 'cached', loading: false, error: null });
          return;
        }
        // Last resort (Rules.md §4: never blank): the 21 bundled fixtures,
        // never persisted — this is a stand-in, not a real snapshot worth
        // overwriting a genuine cached one with on a later visit.
        try {
          const bundled = buildSnapshot(fallbackRecords, Date.now());
          setState({ snapshot: bundled, origin: 'bundled', loading: false, error: null });
        } catch {
          setState({
            snapshot: null,
            origin: 'unavailable',
            loading: false,
            error: liveErr instanceof Error ? liveErr.message : String(liveErr),
          });
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
