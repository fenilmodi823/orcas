import {
  propagate,
  PropagationFailedError,
  temeToJ2000Matrix,
  applyMat3,
  type OmmRecord,
} from '@orcas/physics';
import type { SatRec } from 'satellite.js';
import { orbitalPeriodSec } from './orbit-path.js';

/**
 * Sampling one object's sub-satellite ground track (brief §I M1.7, "ground
 * tracks").
 *
 * ⚠️ **Rendered as a radial projection, not true Earth-fixed geodetic
 * lat/lon.** The scene's Earth mesh does not rotate — GMST-driven Earth
 * rotation is explicitly M1.11 (`memory.md` Next actions #11), not built
 * yet. Converting to real geodetic longitude (`@orcas/physics`'s
 * `eciToGeodeticDeg`, which subtracts GMST) and drawing it on a
 * non-rotating globe would put the track tens to hundreds of degrees away
 * from the satellite that owns it within minutes, since GMST advances
 * ~360°/day while the mesh stands still — a severe, immediately visible
 * bug, not a subtle one. Instead each sample is the object's own J2000
 * position (the same rotation `orbit-path.ts` applies, so the track stays
 * in lockstep with the rendered satellite and its orbit path) scaled down
 * to the Earth's render radius: by construction every sample sits exactly
 * on the ray from Earth's centre through the satellite at that instant, so
 * it can never drift out from underneath it.
 *
 * Consequence worth knowing before looking at it: without true Earth
 * rotation, one full orbital period's track is close to a repeating ring
 * near the orbit's own great-circle shape, not the sinusoidal S-curve a
 * real (rotating-Earth) ground track shows on a map — that shape returns
 * once M1.11 lands.
 *
 * `azimuthsRad` (ECI-frame `atan2(y, x)`, not geodetic longitude) rides
 * alongside the positions purely so `ground-track-split.ts` can detect the
 * atan2 branch-cut wraparound and avoid drawing a chord through the globe.
 *
 * ponytail: samples are spaced uniformly in TIME, matching orbit-path.ts's
 * own D-D precedent (`e < 0.01` for every M1.7b consumer, where time and
 * true-anomaly spacing are visually identical). Same upgrade trigger: a
 * high-eccentricity object.
 */

export const DEFAULT_GROUND_TRACK_SAMPLES = 180;
const EARTH_RADIUS_KM = 6371;
const GROUND_TRACK_OFFSET_KM = 2; // lifts the line clear of the Earth mesh's surface

export class GroundTrackError extends Error {
  constructor(
    readonly noradId: string,
    readonly cause: unknown,
  ) {
    super(`could not sample a ground track for ${noradId}`);
    this.name = 'GroundTrackError';
  }
}

export interface SampleGroundTrackArgs {
  readonly satrec: SatRec;
  readonly record: OmmRecord;
  readonly noradId: string;
  /** Centre of the sampled span, ms since the Unix epoch. */
  readonly atMs: number;
  readonly samples?: number;
  /** Reused across calls to keep this allocation-free on the resample
   * cadence. Must hold `samples * 3` floats. */
  readonly outPositions?: Float32Array;
  /** Must hold `samples` floats. */
  readonly outAzimuthsRad?: Float32Array;
}

export interface GroundTrackSamples {
  readonly positions: Float32Array;
  readonly azimuthsRad: Float32Array;
}

/**
 * Sample one full orbital period's sub-satellite track into `positions` (km,
 * J2000 axes, radially projected onto the Earth's render radius) and
 * `azimuthsRad` (ECI-frame azimuth per sample). Throws `GroundTrackError`
 * if any sample fails to propagate — all-or-nothing, same reasoning as
 * `sampleOrbitPath`: a track silently missing its far half looks like a
 * real track that simply stops.
 */
export function sampleGroundTrack(args: SampleGroundTrackArgs): GroundTrackSamples {
  const { satrec, record, noradId, atMs } = args;
  const samples = args.samples ?? DEFAULT_GROUND_TRACK_SAMPLES;
  if (samples < 2) throw new RangeError(`a ground track needs at least 2 samples, got ${samples}`);

  const positions = args.outPositions ?? new Float32Array(samples * 3);
  if (positions.length < samples * 3) {
    throw new RangeError(`outPositions holds ${positions.length} floats, need ${samples * 3}`);
  }
  const azimuthsRad = args.outAzimuthsRad ?? new Float32Array(samples);
  if (azimuthsRad.length < samples) {
    throw new RangeError(`outAzimuthsRad holds ${azimuthsRad.length} floats, need ${samples}`);
  }

  const periodMs = orbitalPeriodSec(record) * 1000;
  const startMs = atMs - periodMs / 2;
  const stepMs = periodMs / (samples - 1);
  const renderRadiusKm = EARTH_RADIUS_KM + GROUND_TRACK_OFFSET_KM;

  for (let i = 0; i < samples; i++) {
    const at = new Date(startMs + i * stepMs);
    try {
      const state = propagate(satrec, at, noradId);
      const p = applyMat3(temeToJ2000Matrix(at), state.positionEciKm);
      const r = Math.hypot(p.x, p.y, p.z);
      const scale = renderRadiusKm / r;
      positions[i * 3] = p.x * scale;
      positions[i * 3 + 1] = p.y * scale;
      positions[i * 3 + 2] = p.z * scale;
      azimuthsRad[i] = Math.atan2(p.y, p.x);
    } catch (error) {
      if (error instanceof PropagationFailedError) throw new GroundTrackError(noradId, error);
      throw error;
    }
  }

  return { positions, azimuthsRad };
}
