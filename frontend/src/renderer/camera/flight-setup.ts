import { Vector3 } from 'three';
import type { FrameState } from '../../simulation/frame-state.js';
import { framingDistanceKm } from './framing.js';
import type { FlightEndpoint } from './flight-path.js';
import type { CameraRig } from './camera-rig.js';
import { deriveAzElRadius, rigCameraPosition, syncTargetAngles } from './camera-rig.js';
import { ECI_UP } from './look-rotation.js';

const TARGET_EXTENTS_RADIUS_KM = 0.01; // PLACEHOLDER_RADIUS_KM — real per-object sizes are a Data-Strategy follow-up

/**
 * Linear extrapolation of a catalogue object's position to an arbitrary
 * epoch from its FrameState position + velocity. A full Hermite evaluation
 * is an M1.9 refinement; linear is correct to well under 1 % over a ~2 s
 * flight and the keyframe ring is not wired into the camera yet.
 */
export function targetPositionAt(
  frame: FrameState,
  index: number,
  epochMs: number,
  out: Vector3,
): Vector3 {
  const dtS = (epochMs - frame.epochMs) / 1000;
  return out.set(
    frame.positions[index * 3] + frame.velocities[index * 3] * dtS,
    frame.positions[index * 3 + 1] + frame.velocities[index * 3 + 1] * dtS,
    frame.positions[index * 3 + 2] + frame.velocities[index * 3 + 2] * dtS,
  );
}

export interface EndpointsResult {
  readonly camDist0Km: number;
  readonly camDist1Km: number;
}

const _pos = new Vector3();
const _tp = new Vector3();

/**
 * Fill `from` / `to` for the next flight. `from` is the rig's CURRENT pose
 * (never a snap). `to` is either a framing of Earth (using the pre-focus
 * direction/radius) or a framing of the target satellite. Returns the two
 * camera-endpoint distances from Earth's centre for the §C.8 arc lift.
 */
export function buildFlightEndpoints(args: {
  rig: CameraRig;
  refUp: Vector3;
  toEarth: boolean;
  frame: FrameState;
  targetIndex: number;
  preFocusDir: Vector3;
  preFocusRadiusKm: number;
  framingScale?: number;
  from: FlightEndpoint;
  to: FlightEndpoint;
}): EndpointsResult {
  const { rig, from, to } = args;

  rigCameraPosition(rig, _pos);
  from.dir.copy(_pos).sub(rig.pivotKm).normalize();
  from.radiusKm = Math.max(rig.radiusKm, 1e-6);
  from.pivotKm.copy(rig.pivotKm);
  from.refUp.copy(args.refUp);

  if (args.toEarth) {
    to.pivotKm.set(0, 0, 0);
    to.dir.copy(args.preFocusDir);
    to.radiusKm = args.preFocusRadiusKm;
    to.refUp.copy(ECI_UP);
    return { camDist0Km: _pos.length(), camDist1Km: args.preFocusRadiusKm };
  }

  targetPositionAt(args.frame, args.targetIndex, args.frame.epochMs, _tp);
  to.pivotKm.copy(_tp);
  to.dir.copy(from.dir); // approach from where you are
  to.radiusKm = framingDistanceKm(TARGET_EXTENTS_RADIUS_KM, rig.fovDeg, args.framingScale);
  to.refUp.copy(_tp).normalize();
  return { camDist0Km: _pos.length(), camDist1Km: _tp.length() };
}

/**
 * Reduced motion (P4.D21): snap the rig straight to the flight's
 * destination pose and fire the cross-fade — never a bare teleport, never
 * a 2 s flight, never a change to the simulation. `to` must already be
 * built by `buildFlightEndpoints`.
 */
export function applyImmediateArrival(
  rig: CameraRig,
  targetRig: CameraRig,
  refUp: Vector3,
  to: FlightEndpoint,
  onCrossFade?: () => void,
): void {
  rig.pivotKm.copy(to.pivotKm);
  _pos.copy(to.pivotKm).addScaledVector(to.dir, to.radiusKm);
  deriveAzElRadius(rig, _pos);
  syncTargetAngles(targetRig, rig);
  refUp.copy(to.refUp);
  onCrossFade?.();
}
