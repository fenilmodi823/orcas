import { validateRecord } from './catalog-validate.js';
import type { CatalogSnapshot, ObjectMeta, RejectedRecord } from './catalog-types.js';

let nextVersion = 1;

/**
 * Validate and freeze a batch of raw records into a CatalogSnapshot.
 * Rejects malformed records individually — one bad record never throws
 * or aborts the batch — and rejects duplicate NORAD ids, keeping the
 * first occurrence. The whole result is frozen: Tier 1 per the Phase-4
 * brief's §A.4, replaced wholesale, never patched.
 */
export function buildSnapshot(
  rawRecords: readonly unknown[],
  nowMs: number = Date.now(),
): CatalogSnapshot {
  const objects: ObjectMeta[] = [];
  const rejected: RejectedRecord[] = [];
  const byNorad: Record<string, number> = {};

  for (const raw of rawRecords) {
    const result = validateRecord(raw, nowMs);
    if (!result.ok) {
      rejected.push(result.rejection);
      continue;
    }
    if (Object.hasOwn(byNorad, result.meta.norad)) {
      rejected.push({
        reason: 'duplicate-norad-id',
        detail: `NORAD ${result.meta.norad} already present in this batch`,
        raw,
      });
      continue;
    }
    byNorad[result.meta.norad] = objects.length;
    objects.push(result.meta); // already frozen by validateRecord
  }

  return Object.freeze({
    version: nextVersion++,
    fetchedAtMs: nowMs,
    objects: Object.freeze(objects),
    byNorad: Object.freeze(byNorad),
    rejected: Object.freeze(rejected),
  });
}
