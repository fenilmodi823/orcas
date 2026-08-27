import type { PerspectiveCamera, Vector2 } from 'three';
import { Vector3 } from 'three';
import type { CameraRig } from './camera-rig.js';
import { rigCameraPosition } from './camera-rig.js';
import { lookRotation } from './look-rotation.js';
import { computeNearFarKm } from './near-far.js';

const R_EARTH_A_KM = 6378.137;
const NEAR_FAR_EPSILON = 0.01; // 1% — skip a projection rebuild for a tiny change
const _pos = new Vector3();
const _fwd = new Vector3();
const _view = new Vector3();

/** Push the rig's pose onto the camera and keep its world matrices current
 * (so `projectToScreen` is correct immediately after `update`). */
export function writeCameraFromRig(camera: PerspectiveCamera, rig: CameraRig, refUp: Vector3, prevUp: Vector3): void {
  rigCameraPosition(rig, _pos);
  camera.position.copy(_pos);
  _fwd.copy(rig.pivotKm).sub(_pos);
  lookRotation(_fwd, refUp, prevUp, camera.quaternion);
  if (camera.fov !== rig.fovDeg) {
    camera.fov = rig.fovDeg;
    camera.updateProjectionMatrix();
  }
  camera.updateMatrixWorld(true);
}

/**
 * Per-frame near/far (brief §C.7, single-pass reduction — see near-far.ts).
 * Applies the result to the camera in place (only rebuilding the projection
 * matrix when it moved more than 1 %) and also returns it for the
 * `nearFarKm` query. Recomputed AFTER the pose is final and BEFORE the next
 * render, per §C.7's warning about pick/render projection mismatch.
 */
export function applyNearFar(
  camera: PerspectiveCamera,
  inObjectMode: boolean,
  rigRadiusKm: number,
): { nearKm: number; farKm: number } {
  const camDist = camera.position.length();
  const nearestSurface = inObjectMode ? Math.max(0.001, rigRadiusKm) : Math.max(0.001, camDist - R_EARTH_A_KM);
  const nf = computeNearFarKm(nearestSurface, camDist);
  if (
    Math.abs(camera.near - nf.nearKm) / nf.nearKm > NEAR_FAR_EPSILON ||
    Math.abs(camera.far - nf.farKm) / nf.farKm > NEAR_FAR_EPSILON
  ) {
    camera.near = nf.nearKm;
    camera.far = nf.farKm;
    camera.updateProjectionMatrix();
  }
  return nf;
}

/** NDC x/y into `out`; returns false when the point is behind the camera
 * (three cameras look down −Z, so a point is in front when view-space z < 0). */
export function projectToScreen(camera: PerspectiveCamera, posKm: Vector3, out: Vector2): boolean {
  _view.copy(posKm).applyMatrix4(camera.matrixWorldInverse);
  _pos.copy(posKm).project(camera);
  out.set(_pos.x, _pos.y);
  return _view.z < 0;
}
