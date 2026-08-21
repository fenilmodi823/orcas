import { Regime } from './catalog-types.js';
import type { CatalogSnapshot, RejectionReason } from './catalog-types.js';

export interface RegimeCounts {
  leo: number;
  meo: number;
  geo: number;
  heo: number;
  unknown: number;
}

export interface EpochAgeBuckets {
  underOneDay: number;
  oneToSevenDays: number;
  sevenToThirtyDays: number;
  overThirtyDays: number;
}

export type RejectionCounts = Partial<Record<RejectionReason, number>>;

export interface CatalogStats {
  readonly objectCount: number;
  readonly rejectedCount: number;
  readonly regimeCounts: RegimeCounts;
  readonly epochAgeBuckets: EpochAgeBuckets;
  readonly rejectionCounts: RejectionCounts;
}

const REGIME_KEYS: Record<Regime, keyof RegimeCounts> = {
  [Regime.LEO]: 'leo',
  [Regime.MEO]: 'meo',
  [Regime.GEO]: 'geo',
  [Regime.HEO]: 'heo',
  [Regime.Unknown]: 'unknown',
};

const DAY_MS = 86_400_000;

/** Aggregates a CatalogSnapshot into the debug-route stats: regime
 * histogram, epoch-age histogram, rejection breakdown. Pure — no
 * component here reads Tier 1 data directly. */
export function computeCatalogStats(
  snapshot: CatalogSnapshot,
  nowMs: number = Date.now(),
): CatalogStats {
  const regimeCounts: RegimeCounts = { leo: 0, meo: 0, geo: 0, heo: 0, unknown: 0 };
  const epochAgeBuckets: EpochAgeBuckets = {
    underOneDay: 0,
    oneToSevenDays: 0,
    sevenToThirtyDays: 0,
    overThirtyDays: 0,
  };

  for (const obj of snapshot.objects) {
    regimeCounts[REGIME_KEYS[obj.regime]]++;

    const ageDays = (nowMs - obj.epochMs) / DAY_MS;
    if (ageDays < 1) epochAgeBuckets.underOneDay++;
    else if (ageDays < 7) epochAgeBuckets.oneToSevenDays++;
    else if (ageDays < 30) epochAgeBuckets.sevenToThirtyDays++;
    else epochAgeBuckets.overThirtyDays++;
  }

  const rejectionCounts: RejectionCounts = {};
  for (const r of snapshot.rejected) {
    rejectionCounts[r.reason] = (rejectionCounts[r.reason] ?? 0) + 1;
  }

  return {
    objectCount: snapshot.objects.length,
    rejectedCount: snapshot.rejected.length,
    regimeCounts,
    epochAgeBuckets,
    rejectionCounts,
  };
}
