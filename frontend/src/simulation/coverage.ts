import { OrbitClass } from '../data/catalog-types.js';
import type { ObjectMeta } from '../data/catalog-types.js';

const DAY_MS = 86_400_000;

/** How far before its epoch an element set is trusted. */
export const COVERAGE_BACK_MS = 3 * DAY_MS;
/** How far after: LEO is drag-dominated and decays fastest. */
export const COVERAGE_FORWARD_LEO_MS = 5 * DAY_MS;
export const COVERAGE_FORWARD_OTHER_MS = 14 * DAY_MS;

export interface TimeRange {
  readonly startMs: number;
  readonly endMs: number;
}

/**
 * The window over which one element set is honest (brief §E.5, adopting
 * NASA's own coverage concept).
 *
 * A TLE or OMM record is a snapshot of a fitted model, not a measurement. SGP4
 * output degrades roughly 1–3 km per day from epoch and is meaningless within
 * about a week for a drag-dominated LEO object — so outside this window the
 * honest answer is "no data", not a confident orbit drawn from fiction.
 */
export function coverageOf(object: ObjectMeta): TimeRange {
  const forward = object.orbitClass === OrbitClass.LEO ? COVERAGE_FORWARD_LEO_MS : COVERAGE_FORWARD_OTHER_MS;
  return { startMs: object.epochMs - COVERAGE_BACK_MS, endMs: object.epochMs + forward };
}

/**
 * The global scrub range: the union of every object's coverage (§E.5).
 *
 * Its ends are hard stops — dragging past them should feel like hitting a
 * wall, because past them there is genuinely no data for anything. Individual
 * objects go stale well inside this range; that per-object trust is shown on
 * the object, not by narrowing the global range.
 *
 * `null` for an empty catalogue: there is no honest range to offer.
 */
export function scrubRangeOf(objects: readonly ObjectMeta[]): TimeRange | null {
  if (objects.length === 0) return null;
  let startMs = Number.POSITIVE_INFINITY;
  let endMs = Number.NEGATIVE_INFINITY;
  for (const object of objects) {
    const { startMs: s, endMs: e } = coverageOf(object);
    if (s < startMs) startMs = s;
    if (e > endMs) endMs = e;
  }
  return { startMs, endMs };
}

/** True when an epoch falls outside one object's honest window. */
export function isOutsideCoverage(object: ObjectMeta, epochMs: number): boolean {
  const { startMs, endMs } = coverageOf(object);
  return epochMs < startMs || epochMs > endMs;
}

/** Clamp a requested time into a range — the scrubber's end-stops. */
export function clampToRange(epochMs: number, range: TimeRange): number {
  return Math.min(range.endMs, Math.max(range.startMs, epochMs));
}
