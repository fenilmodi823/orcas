import { Matrix4, Quaternion, Vector3 } from 'three';
import { smoothstep } from './easing.js';

/** Earth's rotation axis in J2000 — the pole is up, the horizon is level.
 * Do not mutate. */
export const ECI_UP: Readonly<Vector3> = new Vector3(0, 0, 1);

const _f = new Vector3();
const _u = new Vector3();
const _r = new Vector3();
const _u2 = new Vector3();
const _negF = new Vector3();
const _m = new Matrix4();

/**
 * Roll-free orientation (brief §C.9). Builds the camera basis from a
 * reference up-vector rather than tracking a free quaternion — roll is
 * locked by construction. Degenerate when looking straight along `refUp`
 * (the cross product vanishes and the camera spins wildly): blend toward
 * the PREVIOUS frame's up instead of an arbitrary substitute axis, because
 * an arbitrary axis causes a visible snap. `prevUp` is read and written in
 * place — pass one stable Vector3 per camera.
 */
export function lookRotation(
  forward: Vector3,
  refUp: Vector3,
  prevUp: Vector3,
  out: Quaternion,
): Quaternion {
  _f.copy(forward).normalize();
  _u.copy(refUp).normalize();

  const align = Math.abs(_f.dot(_u));
  if (align > 0.999) {
    const t = smoothstep(0.999, 0.9999, align);
    _u.lerp(prevUp, t);
    if (_u.lengthSq() < 1e-8) _u.copy(prevUp);
    _u.normalize();
    // If prevUp is ALSO parallel to forward (looking exactly at the pole
    // with a pole-aligned previous up), fall back to the least-aligned world
    // axis. Rare corner; a defined orientation beats a NaN.
    if (Math.abs(_f.dot(_u)) > 0.999) {
      _u.set(Math.abs(_f.x) < 0.9 ? 1 : 0, Math.abs(_f.x) < 0.9 ? 0 : 1, 0);
    }
  }

  _r.crossVectors(_f, _u).normalize();
  _u2.crossVectors(_r, _f).normalize(); // re-orthogonalised
  prevUp.copy(_u2);

  _negF.copy(_f).negate();
  _m.makeBasis(_r, _u2, _negF);
  return out.setFromRotationMatrix(_m).normalize();
}

export function refUpForFreeOrbit(out: Vector3): Vector3 {
  return out.copy(ECI_UP);
}

/** LVLH radial: local up is away from Earth. This is the shot that makes an
 * orbital view legible — Earth below, object level (brief §C.9). */
export function refUpForObjectLvlh(targetPosKm: Vector3, out: Vector3): Vector3 {
  out.copy(targetPosKm);
  const len = out.length();
  return len > 1e-6 ? out.multiplyScalar(1 / len) : out.set(0, 0, 1);
}
