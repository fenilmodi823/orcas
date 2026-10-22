// frontend/src/data/horizons-index.ts
import { windowStart } from '../propagation/hermite-window.js';
import { HorizonsEphemerisFormatError, type HorizonsEphemeris, type HorizonsSegment } from './horizons-ephemeris.js';

const FLOATS_PER_KEYFRAME = 6;
/** The widest window the bake writes is 4 (SPK type 13, B.27); room for twice that. */
const MAX_WINDOW = 8;
/** Adjacent segments share a keyframe, to rounding (≤ 5.4 × 10⁻⁵ s measured): closer than this, they touch. */
const TOUCH_S = 1e-3;
// Divided-difference scratch for 2W nodes: module-level, so an evaluation allocates nothing.
const Z = new Float64Array(2 * MAX_WINDOW);
const D = new Float64Array(2 * MAX_WINDOW);

/** An ET interval the export covers, seconds TDB past J2000. */
export type Span = readonly [startEtS: number, endEtS: number];

export interface HorizonsIndex {
  /** Every target the file carries, NAIF ids. */
  readonly targets: readonly number[];
  /**
   * The target's state at ET into `out` as [x, y, z, vx, vy, vz]: km and km/s, ICRF, relative to the returned
   * centre (a NAIF id). Null where the export has no data (B.26: not drawn). The same answer as
   * `horizonsStateAtEt`, found by binary search and evaluated without allocating.
   */
  stateInto(target: number, etS: number, out: Float64Array): number | null;
  /** The ET spans the export covers for a target, touching segments merged, in time order. Empty if unknown. */
  spans(target: number): readonly Span[];
}

interface Timeline {
  /** By start time. */
  readonly segments: readonly HorizonsSegment[];
  readonly starts: Float64Array;
  /** The latest end among segments 0..i: the backward scan stops once no earlier segment reaches the instant. */
  readonly maxEnds: Float64Array;
  /** Each segment's place in the file; the lowest that covers an instant wins, as in `horizonsStateAtEt`. */
  readonly priority: Int32Array;
  readonly spans: readonly Span[];
}

const keyframes = (s: HorizonsSegment) => s.states.length / FLOATS_PER_KEYFRAME;
const endEtS = (s: HorizonsSegment) => s.firstEtS + (keyframes(s) - 1) * s.stepS;

/** `segmentStateKm`'s own coverage test, so the two readers agree to the last bit at a segment's ends. */
function covers(s: HorizonsSegment, etS: number): boolean {
  const u = (etS - s.firstEtS) / s.stepS;
  return u >= 0 && u <= keyframes(s) - 1;
}

/**
 * `segmentStateKm` without allocating (S6b: the moon trails evaluate thousands a frame). The Hermite polynomial
 * through the segment's W states, Newton divided differences with each node repeated, then Horner, exactly as
 * `hermiteWindow`: time in steps and velocity in km per step inside. Output into `out`: km and km/s, ICRF,
 * relative to the segment's centre. The caller has checked `covers`.
 */
export function segmentStateInto(s: HorizonsSegment, etS: number, out: Float64Array): void {
  const count = keyframes(s);
  const u = (etS - s.firstEtS) / s.stepS;
  const k = Math.min(Math.floor(u), count - 2);
  const w = Math.min(s.window, count);
  const lo = windowStart(k, w, count);
  const n = 2 * w;
  for (let i = 0; i < n; i++) Z[i] = lo + (i >> 1);
  for (let axis = 0; axis < 3; axis++) {
    for (let i = 0; i < n; i++) D[i] = s.states[(lo + (i >> 1)) * FLOATS_PER_KEYFRAME + axis] ?? NaN;
    for (let order = 1; order < n; order++) {
      for (let i = n - 1; i >= order; i--) {
        // At order 1 an odd i repeats its node, whose first difference is its velocity.
        D[i] =
          order === 1 && (i & 1) === 1
            ? (s.states[(lo + (i >> 1)) * FLOATS_PER_KEYFRAME + 3 + axis] ?? NaN) * s.stepS
            : ((D[i] ?? NaN) - (D[i - 1] ?? NaN)) / ((Z[i] ?? NaN) - (Z[i - order] ?? NaN));
      }
    }
    let p = D[n - 1] ?? NaN;
    let dp = 0;
    for (let j = n - 2; j >= 0; j--) {
      const dt = u - (Z[j] ?? NaN);
      dp = dp * dt + p;
      p = p * dt + (D[j] ?? NaN);
    }
    out[axis] = p;
    out[3 + axis] = dp / s.stepS;
  }
}

function timeline(target: number, list: readonly HorizonsSegment[]): Timeline {
  for (const s of list) {
    if (s.window > MAX_WINDOW) {
      throw new HorizonsEphemerisFormatError(`NAIF ${target} has a ${s.window}-state window; the reader takes at most ${MAX_WINDOW}`);
    }
  }
  const order = list.map((_, i) => i).sort((a, b) => (list[a]?.firstEtS ?? 0) - (list[b]?.firstEtS ?? 0));
  const segments = order.map((i) => list[i]).filter((s): s is HorizonsSegment => s !== undefined);
  const maxEnds = new Float64Array(segments.length);
  let latest = -Infinity;
  segments.forEach((s, i) => {
    latest = Math.max(latest, endEtS(s));
    maxEnds[i] = latest;
  });
  const spans: [number, number][] = [];
  for (const s of segments) {
    const last = spans[spans.length - 1];
    if (last && s.firstEtS <= last[1] + TOUCH_S) last[1] = Math.max(last[1], endEtS(s));
    else spans.push([s.firstEtS, endEtS(s)]);
  }
  return { segments, starts: Float64Array.from(segments, (s) => s.firstEtS), maxEnds, priority: Int32Array.from(order), spans };
}

/**
 * Index a parsed Horizons file by time (S6b). Per target: segments sorted by start; a binary search finds the
 * last that starts by the instant, then a scan back while an earlier one could still reach it keeps the file's
 * first, as the reader's linear scan does. Throws `HorizonsEphemerisFormatError` for a window wider than 8.
 * ponytail: the scan back is O(overlap depth), one or two steps for the moons; an interval tree if S6c's
 * spacecraft trails, whose series overlap, make it hot.
 */
export function createHorizonsIndex(ephemeris: HorizonsEphemeris): HorizonsIndex {
  const timelines = new Map<number, Timeline>();
  for (const [target, list] of ephemeris.segments) timelines.set(target, timeline(target, list));
  return {
    targets: [...timelines.keys()],
    stateInto(target, etS, out) {
      const t = timelines.get(target);
      if (!t) return null;
      let lo = 0;
      let hi = t.starts.length - 1;
      let at = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if ((t.starts[mid] ?? Infinity) <= etS) {
          at = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      let best: HorizonsSegment | null = null;
      let bestPriority = Infinity;
      for (let i = at; i >= 0 && (t.maxEnds[i] ?? -Infinity) >= etS - TOUCH_S; i--) {
        const s = t.segments[i];
        const p = t.priority[i] ?? Infinity;
        if (s && p < bestPriority && covers(s, etS)) {
          best = s;
          bestPriority = p;
        }
      }
      if (!best) return null;
      segmentStateInto(best, etS, out);
      return best.centre;
    },
    spans: (target) => timelines.get(target)?.spans ?? [],
  };
}
