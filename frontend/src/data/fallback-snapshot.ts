import records from './fallback-snapshot.json';

/**
 * The 21 synthetic-but-physically-consistent OMM fixtures committed at
 * `data/sample/omm-sample.json` (see that folder's README) — the last
 * resort when both a live fetch and the IndexedDB cache come up empty,
 * so the scene never blanks (Rules.md §4). Copied here rather than
 * imported cross-directory: `data/` isn't mounted into the frontend
 * container at all (docker-compose.yml only mounts ./frontend and
 * ./packages), so a `../../../data/...` import would fail both `tsc`
 * (outside `include: ["src"]`) and, more fundamentally, at runtime
 * inside Docker. The fixture is frozen/committed, not regenerated, so
 * this copy has no drift risk. Re-exported from its own tiny module,
 * not imported directly in use-catalog.ts, purely so tests can mock it
 * the same way catalog-client.js/catalog-db.js already are.
 */
export const fallbackRecords: readonly unknown[] = records;
