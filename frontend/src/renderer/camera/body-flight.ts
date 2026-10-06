import { Vector3 } from 'three';
import { clamp } from './easing.js';
import { ellipsoidNormalizedDistance, R_EARTH_A_KM } from './collision.js';
import type { FlightSample } from './flight-path.js';

// NASA Eyes' goToCelestialObject, read from the engine and measured (Reference - NASA Eyes §4.5).
/** Stage 1, the travel: a straight line at constant speed. */
export const TRAVEL_SEC = 0.75;
/** Stage 2, the swing to the lit side: 0.75 s × how far it moves ÷ its distance, never under a fifth of that. */
const SWING_MAX_SEC = 0.75;
const SWING_MIN_SEC = 0.15;
/** NASA arrives at the distance that fits the body in view, × 1.3. */
const FIT_SCALE = 1.3;
/** The Earth clearance every ORCAS flight keeps (flight-path.ts). */
const EARTH_CLEARANCE = (R_EARTH_A_KM + 120) / R_EARTH_A_KM;

/**
 * Camera distance from a body's centre on arrival, km: the distance at which its equatorial radius fills the
 * vertical field of view, × 1.3. The disc then spans about 75 % of the frame height at any field of view.
 */
export function arrivalDistanceKm(equatorialRadiusKm: number, fovVerticalDeg: number): number {
  return (FIT_SCALE * equatorialRadiusKm) / Math.sin((fovVerticalDeg * Math.PI) / 360);
}

/** Stage 2's duration, seconds, from the camera's offsets from the body before and after (km, any frame). */
export function swingDurationSec(fromOffsetKm: Vector3, toOffsetKm: Vector3): number {
  const ratio = clamp(fromOffsetKm.distanceTo(toOffsetKm) / Math.max(fromOffsetKm.length(), 1e-9), 0, 1);
  return Math.max(SWING_MIN_SEC, SWING_MAX_SEC * ratio);
}

export interface BodyFlightSpec {
  /** Where the camera is and what it looks at as the flight begins, km, scene frame. */
  readonly startPositionKm: Vector3;
  readonly startPivotKm: Vector3;
  readonly startRefUp: Vector3;
  /** Stage 1's end, relative to the body: the side the camera came from, at the arrival distance. */
  readonly arrivalOffsetKm: Vector3;
  /** Stage 2's end, relative to the body (its lit side), or null for no swing. */
  readonly swingOffsetKm: Vector3 | null;
  /** The body's north pole, unit: "up" on arrival, as NASA's `destinationUp`. */
  readonly endRefUp: Vector3;
}

const _look0 = new Vector3();
const _look1 = new Vector3();
const _look = new Vector3();
const _dest = new Vector3();
const _a = new Vector3();
const _b = new Vector3();

/** Slerp between unit vectors; exactly opposite ones turn about `axis` (any perpendicular will do). */
function slerpDir(a: Vector3, b: Vector3, u: number, axis: Vector3, out: Vector3): Vector3 {
  const theta = Math.acos(clamp(a.dot(b), -1, 1));
  if (theta < 1e-6) return out.copy(a);
  if (Math.PI - theta < 1e-6) {
    out.crossVectors(axis, a);
    if (out.lengthSq() < 1e-12) out.set(-a.y, a.x, 0);
    if (out.lengthSq() < 1e-12) out.set(0, -a.z, a.y);
    return out.normalize().multiplyScalar(Math.sin(u * Math.PI)).addScaledVector(a, Math.cos(u * Math.PI)).normalize();
  }
  const s = Math.sin(theta);
  return out.copy(a).multiplyScalar(Math.sin((1 - u) * theta) / s).addScaledVector(b, Math.sin(u * theta) / s).normalize();
}

/**
 * NASA Eyes' flight to a body (S5a, B.23), in two stages:
 *
 * 1. **Travel, 0.75 s.** The camera's position moves in a straight line at constant speed to the body plus
 *    `arrivalOffsetKm`, while its view turns from where it was looking to the body (slerp), and "up" turns to
 *    the body's pole. No pull-back, no easing: NASA's `_lerpTransitionFunction`, measured.
 * 2. **Swing to the lit side**, if asked: around the body at the arrival distance, linear in time. NASA lerps the
 *    position along the chord; ORCAS keeps to the arc, so a swing of nearly 180° (arriving on an inner planet's
 *    night side) cannot pass through the body.
 *
 * The body may move during the flight: each tick takes its current position.
 */
export class BodyFlight {
  private elapsedSec = 0;
  private readonly swingSec: number;

  constructor(private readonly spec: BodyFlightSpec) {
    this.swingSec = spec.swingOffsetKm ? swingDurationSec(spec.arrivalOffsetKm, spec.swingOffsetKm) : 0;
  }

  /** Advance by `dtSec` and write the pose for the body at `bodyKm`. Returns true once the flight has ended. */
  tick(dtSec: number, bodyKm: Vector3, out: FlightSample): boolean {
    this.elapsedSec += dtSec;
    const { spec } = this;
    if (this.elapsedSec < TRAVEL_SEC || !spec.swingOffsetKm) {
      const u = clamp(this.elapsedSec / TRAVEL_SEC, 0, 1);
      _dest.copy(bodyKm).add(spec.arrivalOffsetKm);
      out.positionKm.copy(spec.startPositionKm).lerp(_dest, u);
      const norm = ellipsoidNormalizedDistance(out.positionKm);
      if (norm > 0 && norm < EARTH_CLEARANCE) out.positionKm.multiplyScalar(EARTH_CLEARANCE / norm);
      _look0.copy(spec.startPivotKm).sub(spec.startPositionKm).normalize();
      _look1.copy(spec.arrivalOffsetKm).negate().normalize();
      slerpDir(_look0, _look1, u, spec.startRefUp, _look);
      out.pivotKm.copy(out.positionKm).addScaledVector(_look, Math.max(out.positionKm.distanceTo(bodyKm), 1e-6));
      out.refUp.copy(spec.startRefUp).lerp(spec.endRefUp, u);
      if (out.refUp.lengthSq() < 1e-12) out.refUp.copy(spec.endRefUp);
      out.refUp.normalize();
      return u >= 1;
    }
    const v = clamp((this.elapsedSec - TRAVEL_SEC) / this.swingSec, 0, 1);
    const radiusKm = spec.arrivalOffsetKm.length();
    _a.copy(spec.arrivalOffsetKm).normalize();
    _b.copy(spec.swingOffsetKm).normalize();
    slerpDir(_a, _b, v, spec.endRefUp, _look);
    out.positionKm.copy(bodyKm).addScaledVector(_look, radiusKm);
    out.pivotKm.copy(bodyKm);
    out.refUp.copy(spec.endRefUp);
    return v >= 1;
  }
}
