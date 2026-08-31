import { Quaternion, Vector3 } from 'three';
import { refUpForObjectLvlh } from '../camera/look-rotation.js';

const LONG_AXIS = new Vector3(0, 1, 0); // the octahedron's local long axis
const _radial = new Vector3();
const _nadir = new Vector3();

/**
 * Fixed nadir-aligned attitude from the LVLH frame (brief §B.4). The
 * proxy's long axis points at Earth's centre: correct for a stabilised
 * payload, neutral for debris.
 *
 * We deliberately do NOT invent a tumble. Attitude is genuinely unknown
 * for most catalogue objects, and animating a guess is the same class of
 * error as inventing a size.
 *
 * `posKm` is J2000 — the frame FrameState.positions carries. No velocity
 * term: yaw about the nadir axis is unobservable at Tier 1's 3–6 px, so a
 * cross product would buy nothing.
 */
export function lvlhQuaternion(posKm: Vector3, out: Quaternion): Quaternion {
  refUpForObjectLvlh(posKm, _radial); // unit radial, away from Earth
  _nadir.copy(_radial).multiplyScalar(-1);
  return out.setFromUnitVectors(LONG_AXIS, _nadir);
}
