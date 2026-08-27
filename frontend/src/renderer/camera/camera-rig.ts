import { Quaternion, Vector3 } from 'three';
import { clamp } from './easing.js';

export const DEFAULT_FOV_DEG = 35;
const EPS_ELEVATION = 0.001;
export const MAX_ELEVATION_RAD = Math.PI / 2 - EPS_ELEVATION;

const DEFAULT_RADIUS_KM = 42164; // R_GEO — frames the whole GEO ring on boot

/**
 * The animated thing (brief §C.3). The camera is its leaf: never animate a
 * PerspectiveCamera's position directly. Orbit-around-target is a change of
 * `pivotKm` and `frame`, not a change of controller — one code path serves
 * both Earth orbit and object orbit. `radiusKm` is a single scalar so the
 * log-space interpolation of §C.6 is trivial. Manual input and automatic
 * transitions both write these fields; blending them is scalar blending,
 * never matrix blending (matrix blending is where cameras get their
 * "swimming" artefact).
 *
 *   offset  = radius · (cos(el)·cos(az), cos(el)·sin(az), sin(el))
 *   camPos  = pivot + frame · offset
 *
 * `azimuthRad` is longitude in the frame-local XY plane, `elevationRad` is
 * latitude above it (±(π/2−ε), clamped — the poles are the gimbal-flip
 * points). az=0, el=0 ⇒ camera at pivot + frame·(radius, 0, 0): an
 * equatorial view. FOV is constant — zoom is ALWAYS translation along
 * `radius`, never a projection change (a dolly-zoom reads as the world
 * deforming).
 */
export interface CameraRig {
  pivotKm: Vector3; // ECI / J2000, what we orbit
  frame: Quaternion; // basis the az/el offset is expressed in (identity = inertial)
  azimuthRad: number;
  elevationRad: number; // always kept within ±MAX_ELEVATION_RAD
  radiusKm: number; // interpolated in LOG space by callers
  rollRad: number; // normally 0, decays to 0 (unused until roll input exists)
  fovDeg: number;
}

export function createRig(): CameraRig {
  return {
    pivotKm: new Vector3(0, 0, 0),
    frame: new Quaternion(),
    azimuthRad: 0,
    elevationRad: 0,
    radiusKm: DEFAULT_RADIUS_KM,
    rollRad: 0,
    fovDeg: DEFAULT_FOV_DEG,
  };
}

export function clampElevation(elRad: number): number {
  return clamp(elRad, -MAX_ELEVATION_RAD, MAX_ELEVATION_RAD);
}

const _offset = new Vector3();

/** offset = radius·(cos(el)cos(az), cos(el)sin(az), sin(el)); camPos = pivot + frame·offset. Writes `out`. */
export function rigCameraPosition(rig: CameraRig, out: Vector3): Vector3 {
  const ce = Math.cos(rig.elevationRad);
  _offset.set(ce * Math.cos(rig.azimuthRad), ce * Math.sin(rig.azimuthRad), Math.sin(rig.elevationRad));
  _offset.multiplyScalar(rig.radiusKm).applyQuaternion(rig.frame);
  return out.copy(rig.pivotKm).add(_offset);
}

const _local = new Vector3();
const _invFrame = new Quaternion();

/**
 * Inverse of `rigCameraPosition`: given a world camera position, set the
 * rig's az/el/radius so the rig reproduces it under the current pivot and
 * frame. Called when a flight or a manual handoff must leave the rig in a
 * state that manual input can pick up from without a jump.
 */
export function deriveAzElRadius(rig: CameraRig, cameraPosKm: Vector3): void {
  _local.copy(cameraPosKm).sub(rig.pivotKm);
  rig.radiusKm = Math.max(_local.length(), 1e-6);
  _invFrame.copy(rig.frame).invert();
  _local.applyQuaternion(_invFrame).divideScalar(rig.radiusKm); // unit offset in frame-local space
  rig.elevationRad = clampElevation(Math.asin(clamp(_local.z, -1, 1)));
  rig.azimuthRad = Math.atan2(_local.y, _local.x);
}
