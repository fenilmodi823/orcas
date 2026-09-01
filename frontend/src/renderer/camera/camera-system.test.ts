import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector2, Vector3 } from 'three';
import { CancelledError, createCameraSystem, type CameraSystem } from './camera-system.js';
import type { FrameState } from '../../simulation/frame-state.js';

function fakeFrame(positionsKm: number[][]): FrameState {
  const n = positionsKm.length;
  const positions = new Float32Array(3 * n);
  const velocities = new Float32Array(3 * n);
  positionsKm.forEach((p, i) => {
    positions[i * 3] = p[0];
    positions[i * 3 + 1] = p[1];
    positions[i * 3 + 2] = p[2];
    velocities[i * 3 + 1] = 7.6; // +Y motion
  });
  return { epochMs: 1_000_000, count: n, generation: 0, positions, velocities, flags: new Uint8Array(n) };
}

describe('createCameraSystem — freeOrbit', () => {
  it('starts in freeOrbit and, after one update, writes a finite pose to the camera', () => {
    const cam = new PerspectiveCamera(35, 1, 1, 1e6);
    const sys = createCameraSystem(cam);
    expect(sys.state.kind).toBe('freeOrbit');
    sys.update(1 / 60, fakeFrame([[7000, 0, 0]]));
    expect(Number.isFinite(cam.position.x)).toBe(true);
    expect(cam.position.length()).toBeGreaterThan(6378 + 120); // never inside Earth
    expect(cam.quaternion.length()).toBeCloseTo(1, 5);
  });

  it('keeps the horizon level in freeOrbit: camera local X ⊥ ECI +Z', () => {
    const cam = new PerspectiveCamera(35, 1, 1, 1e6);
    const sys = createCameraSystem(cam);
    sys.applyManualInput({ dScreenYawRad: 1.2, dScreenPitchRad: 0.6, dLnRadius: 0 });
    for (let i = 0; i < 120; i++) sys.update(1 / 60, fakeFrame([[7000, 0, 0]]));
    const localX = new Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    expect(Math.abs(localX.dot(new Vector3(0, 0, 1)))).toBeLessThan(1e-3);
  });

  it('clamps dt: a 3-second frame does not teleport the damped rig', () => {
    const cam = new PerspectiveCamera(35, 1, 1, 1e6);
    const sys = createCameraSystem(cam);
    sys.applyManualInput({ dScreenYawRad: 3, dScreenPitchRad: 0, dLnRadius: 0 });
    sys.update(3.0, fakeFrame([[7000, 0, 0]]));
    const after1 = cam.position.clone();
    sys.update(3.0, fakeFrame([[7000, 0, 0]]));
    expect(cam.position.distanceTo(after1)).toBeLessThan(cam.position.length());
  });

  it('wheel zoom damps toward a smaller radius but never inside Earth', () => {
    const cam = new PerspectiveCamera(35, 1, 1, 1e6);
    const sys = createCameraSystem(cam);
    sys.update(1 / 60, fakeFrame([[7000, 0, 0]]));
    const rStart = cam.position.length();
    sys.applyManualInput({ dScreenYawRad: 0, dScreenPitchRad: 0, dLnRadius: -1 }); // zoom in one e-fold
    for (let i = 0; i < 300; i++) sys.update(1 / 60, fakeFrame([[7000, 0, 0]]));
    const rEnd = cam.position.length();
    expect(rEnd).toBeLessThan(rStart);
    expect(rEnd).toBeGreaterThan(6378 + 120);
  });

  it('projectToScreen returns false for a point behind the camera', () => {
    const cam = new PerspectiveCamera(35, 1, 1, 1e6);
    const sys = createCameraSystem(cam);
    sys.update(1 / 60, fakeFrame([[7000, 0, 0]]));
    const behind = cam.position.clone().multiplyScalar(2); // further out, same direction = behind
    const out = new Vector2();
    expect(sys.projectToScreen(behind, out)).toBe(false);
  });

  it('projectToScreen returns true for a point in front (Earth centre, which the camera looks at)', () => {
    const cam = new PerspectiveCamera(35, 1, 1, 1e6);
    const sys = createCameraSystem(cam);
    sys.update(1 / 60, fakeFrame([[7000, 0, 0]]));
    const out = new Vector2();
    expect(sys.projectToScreen(new Vector3(0, 0, 0), out)).toBe(true);
    expect(Math.abs(out.x)).toBeLessThan(1);
    expect(Math.abs(out.y)).toBeLessThan(1);
  });

  it('exposes a near/far that covers the scene', () => {
    const cam = new PerspectiveCamera(35, 1, 1, 1e6);
    const sys = createCameraSystem(cam);
    sys.update(1 / 60, fakeFrame([[7000, 0, 0]]));
    expect(sys.nearFarKm.farKm).toBeGreaterThan(42164);
    expect(sys.nearFarKm.nearKm).toBeGreaterThanOrEqual(0.001);
  });
});

/** Advance a flyTo/flyToEarth promise to completion by pumping frames, with
 * the target advancing along +Y at 7.6 km/s. */
async function runFlight(sys: CameraSystem, p: Promise<void>, frame: FrameState, frames = 320): Promise<void> {
  let epochMs = frame.epochMs;
  for (let i = 0; i < frames; i++) {
    epochMs += 1000 / 60;
    frame.positions[1] = 7.6 * ((epochMs - 1_000_000) / 1000);
    (frame as { epochMs: number }).epochMs = epochMs;
    sys.update(1 / 60, frame);
  }
  await p;
}

describe('CameraSystem — flyTo', () => {
  it('transitions freeOrbit → focusFlight → object, resolving the promise', async () => {
    const cam = new PerspectiveCamera(35, 16 / 9, 1, 1e6);
    const sys = createCameraSystem(cam);
    const frame = fakeFrame([[7000, 0, 0]]);
    sys.update(1 / 60, frame); // one freeOrbit frame so the rig has a real pose
    const p = sys.flyTo(0);
    expect(sys.state.kind).toBe('focusFlight');
    await runFlight(sys, p, frame);
    expect(sys.state.kind).toBe('object');
  });

  it('arrives with the moving target within ~2% of frame centre (brief §I test class 2)', async () => {
    const cam = new PerspectiveCamera(35, 16 / 9, 1, 1e6);
    const sys = createCameraSystem(cam);
    const frame = fakeFrame([[7000, 0, 0]]);
    sys.update(1 / 60, frame);
    const p = sys.flyTo(0);
    await runFlight(sys, p, frame, 400);
    cam.updateMatrixWorld(true);
    const targetNow = new Vector3(7000, frame.positions[1], 0);
    const ndc = targetNow.clone().project(cam);
    expect(Math.hypot(ndc.x, ndc.y)).toBeLessThan(0.06);
  });

  it('a second flyTo cancels the first (CancelledError), no position jump', async () => {
    const cam = new PerspectiveCamera(35, 1, 1, 1e6);
    const sys = createCameraSystem(cam);
    const frame = fakeFrame([[7000, 0, 0], [0, 7000, 0]]);
    sys.update(1 / 60, frame);
    const p1 = sys.flyTo(0);
    for (let i = 0; i < 30; i++) sys.update(1 / 60, frame);
    const before = cam.position.clone();
    const p2 = sys.flyTo(1);
    sys.update(1 / 60, frame);
    expect(cam.position.distanceTo(before)).toBeLessThan(before.length() * 0.1); // continuous, no snap
    await expect(p1).rejects.toBeInstanceOf(CancelledError);
    for (let i = 0; i < 320; i++) sys.update(1 / 60, frame);
    await expect(p2).resolves.toBeUndefined();
  });

  it('grabbing input mid-flight rejects the flight, drops to freeOrbit, keeps the pose continuous', async () => {
    const cam = new PerspectiveCamera(35, 1, 1, 1e6);
    const sys = createCameraSystem(cam);
    const frame = fakeFrame([[7000, 0, 0]]);
    sys.update(1 / 60, frame);
    const p = sys.flyTo(0);
    for (let i = 0; i < 40; i++) sys.update(1 / 60, frame);
    const before = cam.position.clone();
    sys.applyManualInput({ dScreenYawRad: 0.05, dScreenPitchRad: 0, dLnRadius: 0 });
    sys.update(1 / 60, frame);
    expect(sys.state.kind).toBe('freeOrbit');
    expect(cam.position.distanceTo(before)).toBeLessThan(before.length() * 0.1);
    await expect(p).rejects.toBeInstanceOf(CancelledError);
  });

  it('never lets the fly-to arc pass through the Earth', async () => {
    const cam = new PerspectiveCamera(35, 1, 1, 1e6);
    const sys = createCameraSystem(cam);
    const frame = fakeFrame([[6771, 0, 0]]); // a 393 km LEO object
    sys.update(1 / 60, frame);
    const p = sys.flyTo(0);
    let minDist = Infinity;
    for (let i = 0; i < 320; i++) {
      sys.update(1 / 60, frame);
      minDist = Math.min(minDist, cam.position.length());
    }
    await p;
    expect(minDist).toBeGreaterThan(6378 + 100); // stayed outside Earth + atmosphere
  });
});

describe('CameraSystem — object mode', () => {
  it('keeps a moving target centred, with the horizon level (up ≈ target radial)', async () => {
    const cam = new PerspectiveCamera(35, 16 / 9, 1, 1e6);
    const sys = createCameraSystem(cam);
    const frame = fakeFrame([[7000, 0, 0]]);
    sys.update(1 / 60, frame);
    await runFlight(sys, sys.flyTo(0), frame, 400);
    expect(sys.state.kind).toBe('object');

    // 3 more seconds of object mode, target still moving
    let epochMs = frame.epochMs;
    for (let i = 0; i < 180; i++) {
      epochMs += 1000 / 60;
      frame.positions[1] = 7.6 * ((epochMs - 1_000_000) / 1000);
      (frame as { epochMs: number }).epochMs = epochMs;
      sys.update(1 / 60, frame);
    }
    cam.updateMatrixWorld(true);
    const targetNow = new Vector3(7000, frame.positions[1], 0);
    const ndc = targetNow.clone().project(cam);
    expect(Math.hypot(ndc.x, ndc.y)).toBeLessThan(0.05);

    const up = new Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    const rHat = targetNow.clone().normalize();
    expect(up.dot(rHat)).toBeGreaterThan(0); // Earth below, object level
  });

  it('exitToFree flies back to an Earth framing and ends in freeOrbit', async () => {
    const cam = new PerspectiveCamera(35, 1, 1, 1e6);
    const sys = createCameraSystem(cam);
    const frame = fakeFrame([[7000, 0, 0]]);
    sys.update(1 / 60, frame);
    await runFlight(sys, sys.flyTo(0), frame, 400);
    const back = sys.exitToFree();
    for (let i = 0; i < 240; i++) sys.update(1 / 60, frame);
    await expect(back).resolves.toBeUndefined();
    expect(sys.state.kind).toBe('freeOrbit');
    expect(cam.position.length()).toBeGreaterThan(6378 + 120);
  });
});

describe('CameraSystem — reduced motion (P4.D21)', () => {
  it('jumps to the target immediately, fires the cross-fade, never interpolates a flight', async () => {
    const cam = new PerspectiveCamera(35, 16 / 9, 1, 1e6);
    let crossFades = 0;
    const sys = createCameraSystem(cam, { reducedMotion: true, onCrossFade: () => crossFades++ });
    const frame = fakeFrame([[7000, 0, 0]]);
    sys.update(1 / 60, frame);
    const p = sys.flyTo(0);
    sys.update(1 / 60, frame);
    await expect(p).resolves.toBeUndefined();
    expect(crossFades).toBe(1);
    expect(sys.state.kind).toBe('object');
    cam.updateMatrixWorld(true);
    const ndc = new Vector3(7000, 0, 0).project(cam);
    expect(Math.hypot(ndc.x, ndc.y)).toBeLessThan(0.1); // already framing the target
  });

  it('reduced-motion Esc jumps back to freeOrbit', async () => {
    const cam = new PerspectiveCamera(35, 1, 1, 1e6);
    const sys = createCameraSystem(cam, { reducedMotion: true });
    const frame = fakeFrame([[7000, 0, 0]]);
    sys.update(1 / 60, frame);
    await runFlight(sys, sys.flyTo(0), frame, 4);
    const back = sys.flyToEarth();
    sys.update(1 / 60, frame);
    await expect(back).resolves.toBeUndefined();
    expect(sys.state.kind).toBe('freeOrbit');
  });
});
