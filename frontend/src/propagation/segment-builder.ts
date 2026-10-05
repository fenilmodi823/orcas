import type { SatRec } from 'satellite.js';
import { propagate, temeToJ2000Matrix, applyMat3, type SatState } from '@orcas/physics';
import { hermiteState, type Vec3, type HermiteEndpoint } from './hermite.js';

/** One Hermite segment: SGP4-evaluated endpoints, rotated to
 * approximate-J2000 (see @orcas/physics's frames.ts). Position km,
 * velocity km/s. */
export interface PropagationSegment {
  readonly noradId: string;
  readonly t0Ms: number;
  readonly t1Ms: number;
  readonly p0: Vec3;
  readonly v0: Vec3;
  readonly p1: Vec3;
  readonly v1: Vec3;
}

export class SegmentBuildFailedError extends Error {
  constructor(noradId: string, cause: unknown) {
    super(`Failed to build a propagation segment for ${noradId}: ${String(cause)}`);
    this.name = 'SegmentBuildFailedError';
    this.cause = cause;
  }
}

function toJ2000(state: SatState): { position: Vec3; velocity: Vec3 } {
  const matrix = temeToJ2000Matrix(state.at);
  return {
    position: applyMat3(matrix, state.positionEciKm),
    velocity: applyMat3(matrix, state.velocityEciKmS),
  };
}

/**
 * Build one Hermite segment for `satrec` spanning [t0, t1]. Calls SGP4
 * exactly twice — once per endpoint — and rotates each endpoint from
 * TEME into approximate-J2000 once, per brief §A.5 "Frames of
 * reference": recompute the rotation once per segment endpoint, not per
 * object per frame.
 */
export function buildSegment(satrec: SatRec, noradId: string, t0: Date, t1: Date): PropagationSegment {
  try {
    const s0 = toJ2000(propagate(satrec, t0, noradId));
    const s1 = toJ2000(propagate(satrec, t1, noradId));
    return {
      noradId,
      t0Ms: t0.getTime(),
      t1Ms: t1.getTime(),
      p0: s0.position,
      v0: s0.velocity,
      p1: s1.position,
      v1: s1.velocity,
    };
  } catch (cause) {
    throw new SegmentBuildFailedError(noradId, cause);
  }
}

/**
 * Build segments for many objects, skipping any SGP4 cannot propagate over
 * [t0, t1] — a decaying object, a malformed element set. One such object used
 * to fail the whole rebuild, and every object in the catalogue then kept its
 * stale position (seen live 2026-10-03). A skipped object simply has no
 * segment: `evaluateFrame` marks it Stale. The skipped ids are logged once per
 * call, with the time, so the gap is never silent.
 */
export function buildSegmentsSkippingFailures(
  items: readonly { readonly satrec: SatRec; readonly noradId: string }[],
  t0: Date,
  t1: Date,
): PropagationSegment[] {
  const segments: PropagationSegment[] = [];
  const skipped: string[] = [];
  for (const { satrec, noradId } of items) {
    try {
      segments.push(buildSegment(satrec, noradId, t0, t1));
    } catch (error) {
      if (!(error instanceof SegmentBuildFailedError)) throw error;
      skipped.push(noradId);
    }
  }
  if (skipped.length > 0) {
    console.warn(`Segment build skipped ${skipped.length} object(s) SGP4 could not propagate at ${t0.toISOString()}: ${skipped.join(', ')}`);
  }
  return segments;
}

/** Sample a built segment at an instant inside [t0Ms, t1Ms] (clamped). */
export function sampleSegment(segment: PropagationSegment, atMs: number): HermiteEndpoint {
  const hSeconds = (segment.t1Ms - segment.t0Ms) / 1000;
  const rawS = (atMs - segment.t0Ms) / (segment.t1Ms - segment.t0Ms);
  const s = Math.min(1, Math.max(0, rawS));
  return hermiteState(
    { position: segment.p0, velocity: segment.v0 },
    { position: segment.p1, velocity: segment.v1 },
    hSeconds,
    s,
  );
}

/** Build contiguous segments covering [startMs, endMs] at a fixed step. */
export function buildSegmentChain(
  satrec: SatRec,
  noradId: string,
  startMs: number,
  endMs: number,
  hMs: number,
): PropagationSegment[] {
  const segments: PropagationSegment[] = [];
  for (let t0Ms = startMs; t0Ms < endMs; t0Ms += hMs) {
    const t1Ms = Math.min(t0Ms + hMs, endMs);
    segments.push(buildSegment(satrec, noradId, new Date(t0Ms), new Date(t1Ms)));
  }
  return segments;
}

/** Sample a chain of segments at an arbitrary instant covered by it. */
export function sampleChain(segments: readonly PropagationSegment[], atMs: number): HermiteEndpoint {
  const segment = segments.find((s) => atMs >= s.t0Ms && atMs <= s.t1Ms) ?? segments[segments.length - 1];
  return sampleSegment(segment, atMs);
}
