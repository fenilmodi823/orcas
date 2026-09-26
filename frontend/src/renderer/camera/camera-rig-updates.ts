import type { Vector3 } from 'three';
import { dampRigAngles, type CameraRig } from './camera-rig.js';
import { refUpForFreeOrbit, refUpForObjectLvlh } from './look-rotation.js';
import { clampFreeOrbitRadiusKm, R_EARTH_A_KM } from './collision.js';
import { PLACEHOLDER_RADIUS_KM } from '../object-extents.js';

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
