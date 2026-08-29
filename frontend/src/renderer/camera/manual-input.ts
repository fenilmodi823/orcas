import { clampElevation, type CameraRig } from './camera-rig.js';
import { softRepulsionScale } from './collision.js';

export interface ManualInput {
  readonly dAzimuthRad: number;
  readonly dElevationRad: number;
  readonly dLnRadius: number;
}

/**
 * Fold one manual input event into `targetRig` (the rig the live rig damps
 * toward). Azimuth accumulates freely; elevation is pole-clamped; zoom
 * moves in log space and gets heavier (soft repulsion, brief §C.8) as it
 * approaches `minRadiusKm`. Never damps here — that is the caller's
 * per-frame job.
 */
export function accumulateManualInput(targetRig: CameraRig, input: ManualInput, minRadiusKm: number): void {
  targetRig.azimuthRad += input.dAzimuthRad;
  targetRig.elevationRad = clampElevation(targetRig.elevationRad + input.dElevationRad);

  if (input.dLnRadius === 0) return;
  let next = targetRig.radiusKm * Math.exp(input.dLnRadius);
  if (input.dLnRadius < 0) {
    const scale = softRepulsionScale(targetRig.radiusKm, minRadiusKm);
    next = targetRig.radiusKm + (next - targetRig.radiusKm) * scale;
  }
  targetRig.radiusKm = Math.max(minRadiusKm, next);
}
