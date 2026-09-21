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
   * The median element-set epoch — the one figure that honestly stands for a
   * catalogue of tens of thousands of independently-updated objects.
   *
   * The newest epoch is set by a single object, and upstream publishes some
   * deep-space objects ahead of now: on 2026-09-21 TESS alone put the newest
   * epoch nine hours in the future while the simulation clock read 05:54Z. No
   * one outlier can move a median, so the at-rest epoch pill uses this.
   */
  readonly medianEpochMs: number;
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
  /** The clock reading every age above was measured against. */
  readonly nowMs: number;
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
  // ponytail: a full sort on each 30 s provenance tick (~31k numbers, a few
  // ms); cache per snapshot if the catalogue ever grows by an order of magnitude.
  const epochs = Float64Array.from(snapshot.objects, (o) => o.epochMs).sort();
  const mid = epochs.length >> 1;
  const median = empty ? nowMs : epochs.length % 2 ? epochs[mid] : (epochs[mid - 1] + epochs[mid]) / 2;

  return {
    origin,
    sources: [...sources].sort(),
    objectCount: snapshot.objects.length,
    rejectedCount: snapshot.rejected.length,
    newestEpochMs: newest,
    oldestEpochMs: empty ? nowMs : oldestEpochMs,
    medianEpochMs: median,
    newestEpochAgeMs: Math.max(0, nowMs - newest),
    newestEpochIsAhead: newest > nowMs,
    fetchedAgeMs: Math.max(0, nowMs - snapshot.fetchedAtMs),
    nowMs,
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

/**
 * How each ingestion source is credited on screen. Wording follows RA-14 §2.3's
 * provenance line, which names the operator behind the Space-Track catalogue;
 * USSPACECOM's redistribution approval is conditional on that citation
 * (RA14.D3), so this is a licence term, not decoration.
 */
const SOURCE_CREDITS: Readonly<Record<string, string>> = {
  celestrak: 'CelesTrak GP',
  'spacetrack-gp': 'Space-Track.org (18th Space Defense Squadron), GP catalogue',
};

/**
 * RA-14 §2.3: "a provenance line wherever catalogue data is shown, carrying the
 * source name, the query, and the element-set epoch", ending with the plain
 * statement that positions are propagations, not observations.
 *
 * An unrecognised source is shown by its raw id rather than dropped — silently
 * losing an attribution would be worse than an ugly one.
 */
export function formatCreditLine(provenance: CatalogProvenance): string {
  const sources = provenance.sources.map((source) => SOURCE_CREDITS[source] ?? source);
  const origin = sources.length > 0 ? sources.join('; ') : 'unknown source';
  return (
    `Orbital data: ${origin}, median element-set epoch ${formatEpochUtc(provenance.medianEpochMs)}. ` +
    'Positions are SGP4 propagations, not observations.'
  );
}
