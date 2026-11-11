import type { Vector3 } from 'three';
import { dampRigAngles, deriveAzElRadius, syncTargetAngles, type CameraRig } from './camera-rig.js';
import { refUpForFreeOrbit, refUpForObjectLvlh } from './look-rotation.js';
import { clampFreeOrbitRadiusKm, MAX_CAMERA_RADIUS_KM, R_EARTH_A_KM } from './collision.js';
import { PLACEHOLDER_RADIUS_KM } from '../object-extents.js';
import { orbitAroundPivot } from './manual-input.js';

/** Damping half-lives, seconds. */
const AZ_HL = 0.09;
const RADIUS_HL = 0.13;
const ROLL_HL = 0.25;

export const FREE_ORBIT_MIN_RADIUS_KM = R_EARTH_A_KM + 120;
export const OBJECT_MIN_RADIUS_KM = PLACEHOLDER_RADIUS_KM * 1.8;

/** freeOrbit: pivot at Earth's centre, `rig` damps toward `targetRig`. */
export function updateFreeOrbitRig(rig: CameraRig, targetRig: CameraRig, refUp: Vector3, dt: number): void {
  rig.pivotKm.set(0, 0, 0);
  targetRig.pivotKm.set(0, 0, 0);
  rig.frame.copy(targetRig.frame);
  dampRigAngles(rig, targetRig, dt, AZ_HL, RADIUS_HL, ROLL_HL);
  rig.radiusKm = clampFreeOrbitRadiusKm(rig.radiusKm);
  refUpForFreeOrbit(refUp);
}

/**
 * object: the pivot rides the target's position (km, scene frame), "up" is
 * its local vertical. `targetPositionKm` is null when there is no target.
 */
export function updateObjectRig(
  rig: CameraRig,
  targetRig: CameraRig,
  refUp: Vector3,
  targetPositionKm: Vector3 | null,
  dt: number,
): void {
  if (targetPositionKm) {
    rig.pivotKm.copy(targetPositionKm);
    targetRig.pivotKm.copy(targetPositionKm);
    refUpForObjectLvlh(targetPositionKm, refUp);
  }
  dampRigAngles(rig, targetRig, dt, AZ_HL, RADIUS_HL, ROLL_HL);
  rig.radiusKm = Math.max(OBJECT_MIN_RADIUS_KM, rig.radiusKm);
}

/** NASA Eyes' slow orbit after arriving at a body: 0.0100 rad/s, measured (Reference - NASA Eyes §4.5). */
const BODY_SPIN_RAD_PER_S = 0.01;

/**
 * body (S5a): the pivot rides the body's centre and "up" is its pole (`refUp`, set by the caller). The camera
 * orbits about that pole at NASA's rate for `spinDtSec` (0 once the user has taken over), and never comes nearer
 * the centre than `minRadiusKm`. `bodyKm` is null when the body has no position this frame: the pivot holds.
 */
export function updateBodyRig(
  rig: CameraRig,
  targetRig: CameraRig,
  refUp: Vector3,
  bodyKm: Vector3 | null,
  minRadiusKm: number,
  spinDtSec: number,
  dt: number,
): void {
  if (bodyKm) {
    rig.pivotKm.copy(bodyKm);
    targetRig.pivotKm.copy(bodyKm);
  }
  if (spinDtSec > 0) {
    orbitAroundPivot(targetRig, { dScreenYawRad: BODY_SPIN_RAD_PER_S * spinDtSec, dScreenPitchRad: 0, dLnRadius: 0 }, refUp);
  }
  dampRigAngles(rig, targetRig, dt, AZ_HL, RADIUS_HL, ROLL_HL);
  rig.radiusKm = Math.max(minRadiusKm, rig.radiusKm);
}

/**
 * A grab mid-flight (brief §C.11): re-express BOTH rigs as a freeOrbit pose reproducing the camera's exact
 * current world position, so the pivot snap from the flight's look-at back to Earth centre does not jolt the
 * view. targetRig := rig, so the first post-grab frame damps nowhere. The drag basis is built from refUp, so it
 * becomes freeOrbit's before the very first post-grab event uses it, not one frame later.
 */
export function reexpressAsFreeOrbit(rig: CameraRig, targetRig: CameraRig, cameraPositionKm: Vector3, refUp: Vector3): void {
  rig.pivotKm.set(0, 0, 0);
  rig.frame.identity();
  deriveAzElRadius(rig, cameraPositionKm);
  targetRig.pivotKm.set(0, 0, 0);
  targetRig.frame.identity();
  syncTargetAngles(targetRig, rig);
  refUpForFreeOrbit(refUp);
}

/**
 * A grab mid-flight to a satellite: re-express BOTH rigs about the satellite, pivot at `objectKm`, keeping the
 * camera at `cameraPositionKm` (all km, scene frame; the radius is clamped to [minRadiusKm, MAX_CAMERA_RADIUS_KM],
 * which is the only way the camera can move). "Up" becomes the satellite's local vertical, as in `updateObjectRig`.
 */
export function reexpressAroundObject(
  rig: CameraRig,
  targetRig: CameraRig,
  cameraPositionKm: Vector3,
  objectKm: Vector3,
  refUp: Vector3,
  minRadiusKm: number,
): void {
  rig.pivotKm.copy(objectKm);
  rig.frame.identity();
  deriveAzElRadius(rig, cameraPositionKm);
  rig.radiusKm = Math.min(MAX_CAMERA_RADIUS_KM, Math.max(minRadiusKm, rig.radiusKm));
  targetRig.pivotKm.copy(objectKm);
  targetRig.frame.identity();
  syncTargetAngles(targetRig, rig);
  refUpForObjectLvlh(objectKm, refUp);
}

/** Re-express the rigs for a grab: about the satellite when `satelliteKm` is known (returns true), else free orbit (false). */
export function reexpressOnGrab(rig: CameraRig, targetRig: CameraRig, cameraPositionKm: Vector3, satelliteKm: Vector3 | null, refUp: Vector3): boolean {
  if (!satelliteKm) {
    reexpressAsFreeOrbit(rig, targetRig, cameraPositionKm, refUp);
    return false;
  }
  reexpressAroundObject(rig, targetRig, cameraPositionKm, satelliteKm, refUp, OBJECT_MIN_RADIUS_KM);
  return true;
}
