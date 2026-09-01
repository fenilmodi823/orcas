import { Vector3 } from 'three';
import { deriveAzElRadius, rigCameraPosition, type CameraRig } from './camera-rig.js';
import { softRepulsionScale } from './collision.js';

/** Cosine of the closest approach to the up axis a vertical drag may reach.
 * Matches camera-rig's MAX_ELEVATION_RAD = pi/2 - 0.001: the pole is the
 * gimbal-flip point, and crossing it makes continued dragging reverse. */
const POLE_COS_LIMIT = Math.cos(0.001);

export interface ManualInput {
  /** Rotation about the axis the viewer sees as UP, radians. */
  readonly dScreenYawRad: number;
  /** Rotation about the axis the viewer sees as RIGHT, radians. */
  readonly dScreenPitchRad: number;
  readonly dLnRadius: number;
}

const _pos = new Vector3();
const _offset = new Vector3();
const _up = new Vector3();
const _forward = new Vector3();
const _right = new Vector3();
const _pitched = new Vector3();

/**
 * Rotate `targetRig`'s camera offset about the axes the VIEWER sees, then
 * write the result back as az/el/radius.
 *
 * ⭐ Why this is not just `azimuth += d`. The rig's az/el live in `frame`,
 * which is always inertial (ECI). The camera's screen basis is built from
 * `refUp`, which is ECI +Z in freeOrbit but the LVLH RADIAL direction in
 * object mode (look-rotation.ts). Those two agree around Earth and can be
 * 90 degrees apart around a satellite — so incrementing azimuth while
 * focused on an inclined object rotated the view about an axis that had
 * nothing to do with the screen. Measured live on /points: a purely
 * HORIZONTAL drag moved the Earth vertically down the frame.
 *
 * Rotating the offset about the live screen axes is correct in both modes
 * by construction, and in freeOrbit it reduces exactly to the old az/el
 * arithmetic (there `refUp` IS the azimuth pole), so the feel M1.6's review
 * signed off on is preserved bit for bit.
 *
 * Signs, all load-bearing, all pinned by tests — the direct-manipulation
 * contract is "the world follows the pointer":
 *   drag right -> world goes right -> camera goes LEFT  -> yaw   = -dx
 *   drag down  -> world goes down  -> camera goes UP    -> pitch = -dy
 */
export function orbitAroundPivot(targetRig: CameraRig, input: ManualInput, refUp: Vector3): void {
  if (input.dScreenYawRad === 0 && input.dScreenPitchRad === 0) return;

  rigCameraPosition(targetRig, _pos);
  _offset.copy(_pos).sub(targetRig.pivotKm);
  const radiusKm = _offset.length();
  if (radiusKm < 1e-9) return;

  _up.copy(refUp).normalize();
  // forward = pivot - camera; right = forward x up — the same basis
  // lookRotation builds, so "right" here is the right the viewer sees.
  _forward.copy(_offset).multiplyScalar(-1 / radiusKm);
  _right.crossVectors(_forward, _up);
  if (_right.lengthSq() < 1e-12) return; // staring along the up axis: no defined horizon

  _right.normalize();
  _offset.applyAxisAngle(_up, input.dScreenYawRad);

  // Pitch, pole-guarded. Accept the rotation when it lands outside the pole
  // cone, or whenever it moves AWAY from the pole — so a drag can never park
  // the camera somewhere it cannot drag back out of.
  const before = Math.abs(_offset.dot(_up)) / radiusKm;
  _pitched.copy(_offset).applyAxisAngle(_right, input.dScreenPitchRad);
  const after = Math.abs(_pitched.dot(_up)) / radiusKm;
  if (after < POLE_COS_LIMIT || after < before) _offset.copy(_pitched);

  deriveAzElRadius(targetRig, _pos.copy(targetRig.pivotKm).add(_offset));
}

/**
 * Fold one manual input event into `targetRig` (the rig the live rig damps
 * toward). Rotation goes through `orbitAroundPivot`; zoom moves in log space
 * and gets heavier (soft repulsion, brief §C.8) as it approaches
 * `minRadiusKm`. Never damps here — that is the caller's per-frame job.
 */
export function accumulateManualInput(
  targetRig: CameraRig,
  input: ManualInput,
  minRadiusKm: number,
  refUp: Vector3,
): void {
  orbitAroundPivot(targetRig, input, refUp);

  if (input.dLnRadius === 0) return;
  let next = targetRig.radiusKm * Math.exp(input.dLnRadius);
  if (input.dLnRadius < 0) {
    const scale = softRepulsionScale(targetRig.radiusKm, minRadiusKm);
    next = targetRig.radiusKm + (next - targetRig.radiusKm) * scale;
  }
  targetRig.radiusKm = Math.max(minRadiusKm, next);
}

/**
 * Screen-space drag delta (CSS px) → one `ManualInput`.
 *
 * Direct manipulation, the same contract drei's `OrbitControls`, Google Earth
 * and NASA Eyes use: **the world follows the pointer.** Both signs are
 * negative for that reason — the camera always moves opposite the drag — and
 * neither is guessable from the rig maths, so both are pinned by tests. M1.6
 * shipped with the vertical one inverted and 90 green camera tests said
 * nothing, because the mapping lived inline in a DOM event handler where
 * nothing could reach it.
 *
 * `dyPx` grows downward in screen space, which is already the correct sense
 * for a rotation about the rightward axis — hence the same sign as `dxPx`
 * rather than the negation the old azimuth/elevation form needed.
 */
export function dragToManualInput(dxPx: number, dyPx: number, radPerPx: number): ManualInput {
  return { dScreenYawRad: -dxPx * radPerPx, dScreenPitchRad: -dyPx * radPerPx, dLnRadius: 0 };
}

/** Wheel delta → a pure zoom `ManualInput`. */
export function wheelToManualInput(deltaY: number, lnPerUnit: number): ManualInput {
  return { dScreenYawRad: 0, dScreenPitchRad: 0, dLnRadius: deltaY * lnPerUnit };
}
