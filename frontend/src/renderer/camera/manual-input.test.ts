import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { accumulateManualInput, dragToManualInput, wheelToManualInput } from './manual-input.js';
import { createRig, rigCameraPosition } from './camera-rig.js';
import { ECI_UP } from './look-rotation.js';

const R_MIN = 6500;
const K = 0.005; // CAMERA_TUNABLE_DEFAULTS.dragRadPerPx
const FREE_ORBIT_UP = new Vector3().copy(ECI_UP);

/** Where the camera ends up after one drag, from the rig's rest pose. */
function poseAfterDrag(dxPx: number, dyPx: number): Vector3 {
  const rig = createRig();
  accumulateManualInput(rig, dragToManualInput(dxPx, dyPx, K), R_MIN, FREE_ORBIT_UP);
  return rigCameraPosition(rig, new Vector3());
}

describe('dragToManualInput', () => {
  // Direct manipulation: the world follows the pointer. These two signs are
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
    expect(dragToManualInput(120, 0, K).dScreenYawRad).toBeLessThan(0);
    expect(poseAfterDrag(120, 0).y).toBeLessThan(0);
  });

  it('is symmetric and linear in the pixel delta', () => {
    const a = dragToManualInput(10, 10, K);
    const b = dragToManualInput(-10, -10, K);
    expect(a.dScreenYawRad).toBeCloseTo(-b.dScreenYawRad, 12);
    expect(a.dScreenPitchRad).toBeCloseTo(-b.dScreenPitchRad, 12);
    expect(dragToManualInput(20, 0, K).dScreenYawRad).toBeCloseTo(2 * a.dScreenYawRad, 12);
  });

  it('never asks for zoom — drag orbits, wheel zooms', () => {
    expect(dragToManualInput(50, -70, K).dLnRadius).toBe(0);
  });

  it('vertical and horizontal use the same gain, so a diagonal drag reads as diagonal', () => {
    const d = dragToManualInput(60, 60, K);
    expect(Math.abs(d.dScreenYawRad)).toBeCloseTo(Math.abs(d.dScreenPitchRad), 12);
  });
});

describe('wheelToManualInput', () => {
  it('is pure zoom — a scroll never rotates the view', () => {
    const w = wheelToManualInput(100, 0.001);
    expect(w.dScreenYawRad).toBe(0);
    expect(w.dScreenPitchRad).toBe(0);
    expect(w.dLnRadius).toBeCloseTo(0.1, 12);
  });
});

/**
 * The M1.7a review's defect (4): in object mode the rig's az/el frame is
 * inertial but the screen basis is LVLH, so incrementing azimuth rotated
 * about an axis unrelated to the screen. Measured live: a purely horizontal
 * drag moved the Earth vertically down the frame.
 *
 * These pin the property that actually matters — a drag moves the camera
 * along the axis the viewer sees — for an up vector that is NOT the rig's
 * azimuth pole.
 */
describe('orbiting about an up vector that is not the ECI pole', () => {
  /** An object-mode rig: pivot on an inclined orbit, refUp = LVLH radial. */
  function objectModeRig() {
    const rig = createRig();
    rig.pivotKm.set(2745.3, -5986.5, 1672.3); // a real ISS-like position
    rig.radiusKm = 0.0825; // object-mode framing distance
    return rig;
  }
  const lvlhUp = new Vector3(2745.3, -5986.5, 1672.3).normalize();

  function dragOnce(dxPx: number, dyPx: number) {
    const rig = objectModeRig();
    const before = rigCameraPosition(rig, new Vector3());
    accumulateManualInput(rig, dragToManualInput(dxPx, dyPx, K), 0.018, lvlhUp);
    const after = rigCameraPosition(rig, new Vector3());
    // Decompose the camera's movement in the basis the VIEWER sees.
    const forward = before.clone().sub(rig.pivotKm).multiplyScalar(-1).normalize();
    const right = forward.clone().cross(lvlhUp).normalize();
    const up = right.clone().cross(forward).normalize();
    const moved = after.clone().sub(before);
    return { right: moved.dot(right), up: moved.dot(up), radius: rig.radiusKm };
  }

  // Small deltas: over a 34-degree swing the chord's sagitta is real
  // geometry, not axis error, and would mask the property being tested.
  it('a horizontal drag moves the camera horizontally, not vertically', () => {
    const m = dragOnce(4, 0);
    expect(Math.abs(m.right)).toBeGreaterThan(Math.abs(m.up) * 20);
  });

  it('a vertical drag moves the camera vertically, not horizontally', () => {
    const m = dragOnce(0, 4);
    expect(Math.abs(m.up)).toBeGreaterThan(Math.abs(m.right) * 20);
  });

  it('dragging right moves the camera left, so the world follows the pointer', () => {
    expect(dragOnce(120, 0).right).toBeLessThan(0);
  });

  it('dragging down lifts the camera, so the world tips away', () => {
    expect(dragOnce(0, 120).up).toBeGreaterThan(0);
  });

  it('orbiting never changes the distance to the object', () => {
    expect(dragOnce(120, 90).radius).toBeCloseTo(0.0825, 9);
  });

  it('cannot be parked at the pole — a drag out of it is always accepted', () => {
    const rig = objectModeRig();
    for (let i = 0; i < 200; i++) {
      accumulateManualInput(rig, dragToManualInput(0, 120, K), 0.018, lvlhUp);
    }
    const stuck = rigCameraPosition(rig, new Vector3()).sub(rig.pivotKm).normalize();
    accumulateManualInput(rig, dragToManualInput(0, -120, K), 0.018, lvlhUp);
    const freed = rigCameraPosition(rig, new Vector3()).sub(rig.pivotKm).normalize();
    expect(freed.dot(stuck)).toBeLessThan(0.9999);
  });
});
