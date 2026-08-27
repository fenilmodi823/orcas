import { Vector3 } from 'three';
import { clamp } from './easing.js';

const DUR_BASE = 0.55;
const DUR_PER_OCTAVE = 0.075;
const DUR_PER_ANGLE = 0.55;
const DUR_MIN = 1.2;
const DUR_MAX = 2.8;
const SWELL_GAIN = 0.35;

/**
 * Flight duration (brief §C.6). Grows with the LOGARITHM of distance, so a
 * million-fold zoom is only about twice as long as a ten-fold one and no
 * flight ever feels like waiting.
 *
 *   ratio    = max(r0, r1) / min(r0, r1)
 *   octaves  = log2(ratio)
 *   duration = clamp(0.55 + 0.075·octaves + 0.55·(θ/π), 1.2, 2.8)   seconds
 */
export function flightDurationSec(r0Km: number, r1Km: number, thetaRad: number): number {
  const lo = Math.max(1e-6, Math.min(r0Km, r1Km));
  const ratio = Math.max(r0Km, r1Km) / lo;
  const octaves = Math.log2(Math.max(1, ratio));
  const angleTerm = clamp(thetaRad / Math.PI, 0, 1);
  return clamp(DUR_BASE + DUR_PER_OCTAVE * octaves + DUR_PER_ANGLE * angleTerm, DUR_MIN, DUR_MAX);
}

export interface FlightEndpoint {
  dir: Vector3; // unit, pivot → camera
  radiusKm: number;
  pivotKm: Vector3;
  refUp: Vector3; // unit
}

export interface FlightSample {
  positionKm: Vector3;
  pivotKm: Vector3;
  refUp: Vector3;
}

export function angleBetweenDirs(a: Vector3, b: Vector3): number {
  return Math.acos(clamp(a.dot(b) / (a.length() * b.length()), -1, 1));
}

const _dir = new Vector3();

/**
 * Sample the flight path at eased parameter `u ∈ [0, 1]` (brief §C.6).
 *
 *   dir(u)    = slerp(dir0, dir1, u)                    great-circle arc, pivot→camera
 *   radius(u) = r0^(1−u) · r1^u  ·  (1 + A·sin(π·u))    GEOMETRIC + arc swell
 *               A = max(SWELL_GAIN·(θ/π), extraSwellGain)
 *   pivot(u)  = lerp(pivot0, toPivotEstimate, u)        toPivotEstimate is refreshed
 *                                                        every frame by the predictive
 *                                                        retarget (§C.10)
 *   refUp(u)  = normalize(lerp(refUp0, refUp1, u))      blended, never switched at arrival
 *
 * Geometric radius interpolation is the whole trick: it changes scale at a
 * constant ratio per second, which is how the eye perceives approach.
 * Linear radius "looks like nothing happens, then a slam." Because
 * `sin(π·u) ≥ 0`, the swell can only add radius — so `min_u radius(u) =
 * min(r0, r1)` and a slerp+geomLerp arc can never dip below both endpoints
 * (the free collision-safety property of §C.8).
 */
export function sampleFlightPath(
  from: FlightEndpoint,
  to: FlightEndpoint,
  u: number,
  toPivotEstimateKm: Vector3,
  extraSwellGain: number,
  out: FlightSample,
): FlightSample {
  const theta = angleBetweenDirs(from.dir, to.dir);

  if (theta > 1e-4) {
    const s = Math.sin(theta);
    _dir
      .set(0, 0, 0)
      .addScaledVector(from.dir, Math.sin((1 - u) * theta) / s)
      .addScaledVector(to.dir, Math.sin(u * theta) / s);
  } else {
    _dir.copy(from.dir);
  }
  _dir.normalize();

  const geom = Math.exp((1 - u) * Math.log(from.radiusKm) + u * Math.log(to.radiusKm));
  const a = Math.max(SWELL_GAIN * (theta / Math.PI), extraSwellGain);
  const radius = geom * (1 + a * Math.sin(Math.PI * u));

  out.pivotKm.copy(from.pivotKm).lerp(toPivotEstimateKm, u);
  out.positionKm.copy(out.pivotKm).addScaledVector(_dir, radius);
  out.refUp.copy(from.refUp).lerp(to.refUp, u).normalize();
  return out;
}
