import { propagate, PropagationFailedError, type OmmRecord } from '@orcas/physics';
import type { SatRec } from 'satellite.js';

/**
 * Sampling one object's orbit into a polyline (brief §I M1.7, "orbit paths").
 *
 * ⭐ The path is **propagated, not drawn as an ellipse.** A two-body ellipse
 * from the Keplerian elements would be cheaper and wrong: SGP4 carries J2
 * oblateness and drag, so a real orbit precesses and decays. Sampling the
 * same propagator the object itself uses is the only way the path and the
 * satellite agree — a satellite visibly off its own orbit line is the most
 * obvious possible rendering bug, and it is what a Kepler path produces.
 *
 * ⚠️ **A real orbit does not close.** After exactly one period the object is
 * not back where it started: nodal regression and drag have moved it. This
 * module therefore never joins the last sample to the first. The gap is
 * real, it is usually sub-pixel, and closing it would be inventing a
 * position — the same class of error as inventing a size.
 */

/** Enough to keep a LEO orbit's curvature under a pixel at typical framing,
 * cheap enough to redo for every focus change. Brief §I asks for resampling
 * at 0.2 Hz, not per frame — that cadence is the caller's job. */
export const DEFAULT_PATH_SAMPLES = 180;

const SECONDS_PER_DAY = 86_400;

export class OrbitPathError extends Error {
  constructor(
    readonly noradId: string,
    readonly cause: unknown,
  ) {
    super(`could not sample an orbit path for ${noradId}`);
    this.name = 'OrbitPathError';
  }
}

/**
 * Orbital period in seconds, from the record's own mean motion.
 *
 * `MEAN_MOTION` is revolutions per day, so the period is simply
 * `86400 / n`. This is the *mean* period the element set was fitted with,
 * which is exactly the span one path should cover — not a period derived
 * from the semi-major axis, which the record does not carry.
 */
export function orbitalPeriodSec(record: OmmRecord): number {
  const revsPerDay = record.MEAN_MOTION;
  if (!Number.isFinite(revsPerDay) || revsPerDay <= 0) {
    throw new RangeError(`MEAN_MOTION must be a positive number of rev/day, got ${String(revsPerDay)}`);
  }
  return SECONDS_PER_DAY / revsPerDay;
}

export interface SampleOrbitPathArgs {
  readonly satrec: SatRec;
  readonly record: OmmRecord;
  readonly noradId: string;
  /** Centre of the sampled span, ms since the Unix epoch. */
  readonly atMs: number;
  readonly samples?: number;
  /** Reused across calls to keep this allocation-free on the resample
   * cadence. Must hold `samples * 3` floats. */
  readonly out?: Float32Array;
}

/**
 * Sample one full orbital period into `out` as ECI positions in km, three
 * floats per sample.
 *
 * The span is centred on `atMs` — half a period behind, half ahead — so the
 * object sits in the middle of its own path rather than at one end. That
 * matters for a decaying orbit, where the path a full period ahead is
 * visibly different from the path behind.
 *
 * Throws `OrbitPathError` if any sample fails to propagate. Deliberately
 * all-or-nothing: a path silently missing its far half looks like a real
 * orbit that simply stops, which is worse than no path at all. The caller
 * draws nothing for that object and the object keeps its point.
 */
export function sampleOrbitPath(args: SampleOrbitPathArgs): Float32Array {
  const { satrec, record, noradId, atMs } = args;
  const samples = args.samples ?? DEFAULT_PATH_SAMPLES;
  if (samples < 2) throw new RangeError(`a path needs at least 2 samples, got ${samples}`);

  const out = args.out ?? new Float32Array(samples * 3);
  if (out.length < samples * 3) {
    throw new RangeError(`out holds ${out.length} floats, need ${samples * 3}`);
  }

  const periodMs = orbitalPeriodSec(record) * 1000;
  const startMs = atMs - periodMs / 2;
  // samples - 1 intervals, so the first and last samples are exactly one
  // period apart. Not samples, which would leave a one-step gap and make
  // the "does not close" gap larger than the physics alone.
  const stepMs = periodMs / (samples - 1);

  for (let i = 0; i < samples; i++) {
    const at = new Date(startMs + i * stepMs);
    try {
      const state = propagate(satrec, at, noradId);
      out[i * 3] = state.positionEciKm.x;
      out[i * 3 + 1] = state.positionEciKm.y;
      out[i * 3 + 2] = state.positionEciKm.z;
    } catch (error) {
      if (error instanceof PropagationFailedError) throw new OrbitPathError(noradId, error);
      throw error;
    }
  }

  return out;
}

/**
 * Expand `samples` positions into the vertex pairs a `LineSegments` draws:
 * `[p0,p1, p1,p2, p2,p3, ...]`, so one buffer carries the whole path with
 * no index buffer and no per-object draw call.
 *
 * `LineSegments` rather than `Line` because many paths merge into one
 * geometry that way; `Line` would need one object each, and the brief's
 * budget (§G) counts draw calls, not vertices.
 */
export function toLineSegments(positions: Float32Array, samples: number, out?: Float32Array): Float32Array {
  const segments = samples - 1;
  const target = out ?? new Float32Array(segments * 6);
  if (target.length < segments * 6) {
    throw new RangeError(`out holds ${target.length} floats, need ${segments * 6}`);
  }
  for (let i = 0; i < segments; i++) {
    target[i * 6] = positions[i * 3];
    target[i * 6 + 1] = positions[i * 3 + 1];
    target[i * 6 + 2] = positions[i * 3 + 2];
    target[i * 6 + 3] = positions[(i + 1) * 3];
    target[i * 6 + 4] = positions[(i + 1) * 3 + 1];
    target[i * 6 + 5] = positions[(i + 1) * 3 + 2];
  }
  return target;
}
