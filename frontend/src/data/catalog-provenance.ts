import type { CatalogOrigin } from './use-catalog.js';
import type { CatalogSnapshot } from './catalog-types.js';

/**
 * Where the catalogue on screen came from and how old it is.
 *
 * This exists because Rules.md bans "presenting stale data as live" and
 * requires the element-set epoch to always be shown, and because the
 * catalogue now mixes ingestion sources (CelesTrak GP plus Space-Track gp),
 * where attribution is a hard requirement rather than a courtesy
 * (RA14.D3/D5). It is derived from the snapshot itself, so it needs no extra
 * request and stays correct when the backend is unreachable and the scene is
 * running from cache or the bundled fixtures.
 *
 * Pure — no React, no fetch.
 */
export interface CatalogProvenance {
  readonly origin: CatalogOrigin;
  /** Distinct ingestion sources present, sorted. */
  readonly sources: readonly string[];
  readonly objectCount: number;
  readonly rejectedCount: number;
  /** Newest element-set epoch in the snapshot. */
  readonly newestEpochMs: number;
  readonly oldestEpochMs: number;
  /**
   * Age of the newest element set, clamped at zero.
   *
   * Upstream legitimately publishes some epochs ahead of now — Space-Track's
   * gp class does for several deep-space objects — so this can be negative
   * before clamping. A readout must never show a negative age; it says
   * "published ahead" instead, which `newestEpochIsAhead` selects.
   */
  readonly newestEpochAgeMs: number;
  readonly newestEpochIsAhead: boolean;
  /** Age of the snapshot fetch itself, distinct from the element-set epoch:
   * snapshot age and epoch are two separate facts, never merged (RA14.D6). */
  readonly fetchedAgeMs: number;
}

export function describeProvenance(
  snapshot: CatalogSnapshot,
  origin: CatalogOrigin,
  nowMs: number,
): CatalogProvenance {
  let newestEpochMs = Number.NEGATIVE_INFINITY;
  let oldestEpochMs = Number.POSITIVE_INFINITY;
  const sources = new Set<string>();

  for (const object of snapshot.objects) {
    if (object.epochMs > newestEpochMs) newestEpochMs = object.epochMs;
    if (object.epochMs < oldestEpochMs) oldestEpochMs = object.epochMs;
    sources.add(object.source);
  }

  const empty = snapshot.objects.length === 0;
  const newest = empty ? nowMs : newestEpochMs;

  return {
    origin,
    sources: [...sources].sort(),
    objectCount: snapshot.objects.length,
    rejectedCount: snapshot.rejected.length,
    newestEpochMs: newest,
    oldestEpochMs: empty ? nowMs : oldestEpochMs,
    newestEpochAgeMs: Math.max(0, nowMs - newest),
    newestEpochIsAhead: newest > nowMs,
    fetchedAgeMs: Math.max(0, nowMs - snapshot.fetchedAtMs),
  };
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Coarse, honest age: the point is "how stale", not a stopwatch. */
export function formatAge(ms: number): string {
  if (ms < MINUTE_MS) return 'just now';
  if (ms < HOUR_MS) return `${Math.floor(ms / MINUTE_MS)} min ago`;
  if (ms < DAY_MS) return `${Math.floor(ms / HOUR_MS)} h ago`;
  const days = Math.floor(ms / DAY_MS);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

/** ISO-8601 UTC to the second — the epoch itself, never a relative word. */
export function formatEpochUtc(ms: number): string {
  return `${new Date(ms).toISOString().slice(0, 19).replace('T', ' ')} UTC`;
}

const ORIGIN_LABELS: Readonly<Record<CatalogOrigin, string>> = {
  live: 'live from the backend',
  cached: 'last cached snapshot — the backend was unreachable',
  bundled: 'bundled sample fixtures — no live or cached data available',
  unavailable: 'no catalogue data',
};

export function describeOrigin(origin: CatalogOrigin): string {
  return ORIGIN_LABELS[origin];
}

/** True when what is on screen is not live data and the UI must say so. */
export function isStale(origin: CatalogOrigin): boolean {
  return origin !== 'live';
}
