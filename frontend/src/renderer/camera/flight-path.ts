import { Vector3 } from 'three';
import { clamp, smoothstep } from './easing.js';
import { ellipsoidNormalizedDistance, R_EARTH_A_KM } from './collision.js';

const DUR_BASE = 0.55;
const DUR_PER_OCTAVE = 0.1; // raised 2026-09-01 with the approach blend: a longer flight is only worth it once the extra time lands where there is something to watch
const DUR_PER_ANGLE = 0.55;
const DUR_MIN = 1.2;
const DUR_MAX = 3.4; // raised 2026-09-01: the extra time lands in the final approach, which is the only part with anything to look at
const SWELL_GAIN = 0.35;

/** How much of the timeline the pivot takes to slide from where the camera
 * was orbiting onto the target. Tightened 0.35 -> 0.15 on 2026-09-01: the
 * camera-to-object distance is only governed by radius(u) AFTER the pivot
 * has locked on, so a long handover leaves the object jumping into view at
 * whatever size the radius curve had already reached. Measured: with 0.35
 * the object entered the visible range as a 27x single-frame jump to 13 px.
 * Locking earlier also strictly helps the through-the-Earth guard, which is
 * why the handover was front-loaded in the first place. */
const PIVOT_LOCK_U = 0.15;

/**
 * Flight duration (brief §C.6). Grows with the LOGARITHM of distance, so a
 * million-fold zoom is only about twice as long as a ten-fold one and no
 * flight ever feels like waiting.
 *
 *   ratio    = max(r0, r1) / min(r0, r1)
 *   octaves  = log2(ratio)
 *   duration = clamp(0.55 + 0.1·octaves + 0.55·(θ/π), 1.2, 3.4)   seconds
 */
export function flightDurationSec(r0Km: number, r1Km: number, thetaRad: number): number {
  const lo = Math.max(1e-6, Math.min(r0Km, r1Km));
  const ratio = Math.max(r0Km, r1Km) / lo;
  const octaves = Math.log2(Math.max(1, ratio));
  const angleTerm = clamp(thetaRad / Math.PI, 0, 1);
  return clamp(DUR_BASE + DUR_PER_OCTAVE * octaves + DUR_PER_ANGLE * angleTerm, DUR_MIN, DUR_MAX);
}

/** Default radius blend. See `blendRadiusKm`. */
export const APPROACH_BLEND = 0.35;

/**
 * Interpolate the flight radius between the two things "approach" can mean,
 * on one parameter.
 *
 *   r(u) = [ (1-u) * r0^(-p) + u * r1^(-p) ] ^ (-1/p)
 *
 * **p -> 0 is geometric** — a constant RATIO of radius per second. It is
 * what brief C.6 specifies and it is right for the traverse: a fixed number
 * of doublings per second is how the eye reads approach through empty space.
 *
 * **p = 1 is reciprocal** — a constant APPARENT SIZE increase per second,
 * because apparent size goes as 1/r. It is right for the arrival, where
 * there is finally something on screen whose size means anything.
 *
 * Geometric alone is why an object "appeared out of nowhere". Measured on
 * /points: a fly-to covers 42,164 km to 82 m, and the object only subtends
 * 3 px inside the last 4 km — 19% of the log range, which landed as 611 ms
 * of a 1.93 s flight. Everything worth watching happened at the very end.
 *
 * The trade is real and deliberate: the empty traverse gets faster so the
 * arrival can get slower. Exposed on the dev panel because which side of
 * that trade feels right is a judgement, not a derivation.
 */
export function blendRadiusKm(r0Km: number, r1Km: number, u: number, p = APPROACH_BLEND): number {
  if (p <= 1e-6) return Math.exp((1 - u) * Math.log(r0Km) + u * Math.log(r1Km));
  const f0 = Math.pow(r0Km, -p);
  const f1 = Math.pow(r1Km, -p);
  return Math.pow((1 - u) * f0 + u * f1, -1 / p);
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
 *   radius(u) = blendRadiusKm(r0, r1, u, p) · (1 + A·sin(π·u))   see blendRadiusKm
 *               A = max(SWELL_GAIN·(θ/π), extraSwellGain)
 *   pivot(u)  = lerp(pivot0, toPivotEstimate, smoothstep(0, PIVOT_LOCK_U, u))
 *                                                        STEEPLY FRONT-LOADED: the
 *                                                        geometric radius drops below
 *                                                        R_earth very early in the
 *                                                        timeline, so the pivot must
 *                                                        lock onto the target before
 *                                                        then or an Earth-view →
 *                                                        satellite flight would pass the
 *                                                        camera through the planet. The
 *                                                        predictive retarget (§C.10)
 *                                                        refreshes toPivotEstimate every
 *                                                        frame.
 *   refUp(u)  = normalize(lerp(refUp0, refUp1, u))      blended, never switched at arrival
 *
 * As a hard safety net, the sampled camera position is pushed back out of
 * the Earth ellipsoid (`R_earth + 120 km`) if the arc ever clips it — rare
 * with the front-loaded pivot, but a single clamped frame beats a
 * through-the-planet shot. Task 15 tunes the curve so the clamp is
 * effectively never hit in practice.
 *
 * Geometric radius interpolation is the whole trick: it changes scale at a
 * constant ratio per second, which is how the eye perceives approach.
 * Linear radius "looks like nothing happens, then a slam." Because
 * `sin(π·u) ≥ 0`, the swell can only add radius to a pivot-relative arc.
 */
export function sampleFlightPath(
  from: FlightEndpoint,
  to: FlightEndpoint,
  u: number,
  toPivotEstimateKm: Vector3,
  extraSwellGain: number,
  out: FlightSample,
  approachBlend = APPROACH_BLEND,
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

  const geom = blendRadiusKm(from.radiusKm, to.radiusKm, u, approachBlend);
  const a = Math.max(SWELL_GAIN * (theta / Math.PI), extraSwellGain);
  const radius = geom * (1 + a * Math.sin(Math.PI * u));

  out.pivotKm.copy(from.pivotKm).lerp(toPivotEstimateKm, smoothstep(0, PIVOT_LOCK_U, u));
  out.positionKm.copy(out.pivotKm).addScaledVector(_dir, radius);

  // Hard safety net: keep the camera outside the Earth ellipsoid + 120 km.
  const clearance = (R_EARTH_A_KM + 120) / R_EARTH_A_KM;
  const norm = ellipsoidNormalizedDistance(out.positionKm);
  if (norm > 0 && norm < clearance) {
    out.positionKm.multiplyScalar(clearance / norm);
  }

  out.refUp.copy(from.refUp).lerp(to.refUp, u).normalize();
  return out;
}
