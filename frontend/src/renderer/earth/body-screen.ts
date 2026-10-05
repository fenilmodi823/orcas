import { Vector3, type Camera } from 'three';
import { WGS84_A_KM, WGS84_B_KM } from '@orcas/physics';

export interface BodyScreenPosition {
  xPx: number;
  yPx: number;
  visible: boolean;
}

const _view = new Vector3();
const _ndc = new Vector3();
const _ro = new Vector3();
const _rd = new Vector3();
const _from = new Vector3();
const _to = new Vector3();
const ORIGIN = new Vector3();
const STRETCH = WGS84_A_KM / WGS84_B_KM;

/**
 * Does a sphere block the straight line from `fromKm` to `toKm`? Analytic,
 * so it holds at any depth-buffer precision. Input: km, scene frame.
 */
export function sphereBlocks(fromKm: Vector3, toKm: Vector3, centreKm: Vector3, radiusKm: number): boolean {
  _rd.copy(toKm).sub(fromKm);
  const length = _rd.length();
  _rd.divideScalar(length);
  _ro.copy(fromKm).sub(centreKm);
  const b = _ro.dot(_rd);
  const h = b * b - (_ro.lengthSq() - radiusKm * radiusKm);
  if (h < 0) return false;
  const t = -b - Math.sqrt(h);
  return t > 0 && t < length;
}

/**
 * Does the Earth (WGS84 ellipsoid) block the straight line from `fromKm` to
 * `toKm`? Stretching z by a/b turns the ellipsoid into a sphere of radius a.
 * Input: km, scene frame.
 */
export function earthBlocks(fromKm: Vector3, toKm: Vector3): boolean {
  _from.set(fromKm.x, fromKm.y, fromKm.z * STRETCH);
  _to.set(toKm.x, toKm.y, toKm.z * STRETCH);
  return sphereBlocks(_from, _to, ORIGIN, WGS84_A_KM);
}

/**
 * Where a body at `worldKm` lands on screen, in CSS pixels from the top-left,
 * and whether it can be seen: in front of the camera and not behind the Earth.
 */
export function bodyScreenPosition(
  worldKm: Vector3,
  camera: Camera,
  widthPx: number,
  heightPx: number,
  out: BodyScreenPosition,
): BodyScreenPosition {
  _view.copy(worldKm).applyMatrix4(camera.matrixWorldInverse);
  _ndc.copy(worldKm).project(camera);
  out.xPx = ((_ndc.x + 1) / 2) * widthPx;
  out.yPx = ((1 - _ndc.y) / 2) * heightPx;
  out.visible = _view.z < 0 && Math.abs(_ndc.x) <= 1 && Math.abs(_ndc.y) <= 1 && !earthBlocks(camera.position, worldKm);
  return out;
}
