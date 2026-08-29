import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { accumulateManualInput, dragToManualInput } from './manual-input.js';
import { createRig, rigCameraPosition } from './camera-rig.js';

const R_MIN = 6500;
const K = 0.005; // CAMERA_TUNABLE_DEFAULTS.dragRadPerPx

/** Where the camera ends up after one drag, from the rig's rest pose. */
function poseAfterDrag(dxPx: number, dyPx: number): Vector3 {
  const rig = createRig();
  accumulateManualInput(rig, dragToManualInput(dxPx, dyPx, K), R_MIN);
  return rigCameraPosition(rig, new Vector3());
}

describe('dragToManualInput', () => {
  // Direct manipulation: the globe follows the pointer. These two signs are
  // the whole contract, and M1.6 shipped with the vertical one inverted —
  // "when I move down, the earth rotates up" (Fenil, 2026-08-29).
  it('dragging DOWN lifts the camera (globe tips away, not toward you)', () => {
    const before = rigCameraPosition(createRig(), new Vector3());
    const after = poseAfterDrag(0, 120);
    expect(after.z).toBeGreaterThan(before.z);
  });

  it('dragging UP lowers the camera', () => {
    expect(poseAfterDrag(0, -120).z).toBeLessThan(0);
  });

  it('dragging RIGHT swings the camera anticlockwise so the globe travels right', () => {
    expect(dragToManualInput(120, 0, K).dAzimuthRad).toBeLessThan(0);
    expect(poseAfterDrag(120, 0).y).toBeLessThan(0);
  });

  it('is symmetric and linear in the pixel delta', () => {
    const a = dragToManualInput(10, 10, K);
    const b = dragToManualInput(-10, -10, K);
    expect(a.dAzimuthRad).toBeCloseTo(-b.dAzimuthRad, 12);
    expect(a.dElevationRad).toBeCloseTo(-b.dElevationRad, 12);
    expect(dragToManualInput(20, 0, K).dAzimuthRad).toBeCloseTo(2 * a.dAzimuthRad, 12);
  });

  it('never asks for zoom — drag orbits, wheel zooms', () => {
    expect(dragToManualInput(50, -70, K).dLnRadius).toBe(0);
  });

  it('vertical and horizontal use the same gain, so a diagonal drag reads as diagonal', () => {
    const d = dragToManualInput(60, 60, K);
    expect(Math.abs(d.dAzimuthRad)).toBeCloseTo(Math.abs(d.dElevationRad), 12);
  });
});
