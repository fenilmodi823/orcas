import type { ObjectMeta } from '../data/catalog-types.js';
import type { PropagationPool } from '../propagation/worker-pool.js';
import type { PropagationSegment } from '../propagation/segment-builder.js';

/** Per-object last-known-good Hermite segment for one time window, keyed
 * by NORAD id — brief §A.5's "KeyframeRing." Deeply immutable: a rebuild
 * never patches this map, it replaces it wholesale (brief §A.4 Tier 1
 * discipline applied to Tier-3-adjacent data). */
export interface KeyframeRing {
  readonly segments: ReadonlyMap<string, PropagationSegment>;
  readonly windowT0Ms: number;
  readonly windowT1Ms: number;
  readonly generation: number;
}

export function createEmptyRing(): KeyframeRing {
  return { segments: new Map(), windowT0Ms: 0, windowT1Ms: 0, generation: 0 };
}

export interface RebuildResult {
  readonly ring: KeyframeRing;
  readonly ok: boolean;
}

/**
 * Rebuild the ring for `[t0Ms, t1Ms)`. On success, replaces every
 * object's segment in one atomic swap and bumps `generation`. On
 * failure (brief §I M1.2 "Worker failure" — a worker died mid-build),
 * the PREVIOUS ring is returned unchanged: never a partial map, never a
 * segment with `NaN` in it. The caller is expected to retry (see
 * `loop.ts`'s `needsRebuild`); `sampleSegment` clamps its parameter to
 * `[0,1]` (segment-builder.ts), so evaluating a stale-but-valid ring
 * past its window just holds the last good position rather than
 * producing garbage.
 */
export async function rebuildRing(
  ring: KeyframeRing,
  pool: PropagationPool,
  objects: readonly ObjectMeta[],
  t0Ms: number,
  t1Ms: number,
): Promise<RebuildResult> {
  try {
    const built = await pool.buildSegments(objects, t0Ms, t1Ms);
    const segments = new Map(built.map((s) => [s.noradId, s] as const));
    return {
      ring: { segments, windowT0Ms: t0Ms, windowT1Ms: t1Ms, generation: ring.generation + 1 },
      ok: true,
    };
  } catch (cause) {
    console.error('rebuildRing: segment build failed, keeping the previous ring', cause);
    return { ring, ok: false };
  }
}
