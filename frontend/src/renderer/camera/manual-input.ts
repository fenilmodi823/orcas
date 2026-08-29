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

/**
 * Screen-space drag delta (CSS px) → one `ManualInput`.
 *
 * Direct manipulation, the same contract drei's `OrbitControls`, Google Earth
 * and NASA Eyes use: **the globe follows the pointer.** Drag right and the
 * near face travels right, which swings the camera the other way, so azimuth
 * *decreases*. Drag down and the near face travels down, which lifts the
 * camera over the pole, so elevation *increases* — `dyPx` is therefore NOT
 * negated even though screen-y grows downward.
 *
 * Both signs are load-bearing and neither is guessable from the rig maths, so
 * they are pinned by tests: M1.6 shipped with the vertical one inverted and
 * 90 green camera tests said nothing, because the mapping lived inline in a
 * DOM event handler where nothing could reach it.
 */
export function dragToManualInput(dxPx: number, dyPx: number, radPerPx: number): ManualInput {
  return { dAzimuthRad: -dxPx * radPerPx, dElevationRad: dyPx * radPerPx, dLnRadius: 0 };
}
