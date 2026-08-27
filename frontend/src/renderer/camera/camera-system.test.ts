import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector2, Vector3 } from 'three';
import { createCameraSystem } from './camera-system.js';
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
    sys.applyManualInput({ dAzimuthRad: 1.2, dElevationRad: 0.6, dLnRadius: 0 });
    for (let i = 0; i < 120; i++) sys.update(1 / 60, fakeFrame([[7000, 0, 0]]));
    const localX = new Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    expect(Math.abs(localX.dot(new Vector3(0, 0, 1)))).toBeLessThan(1e-3);
  });

  it('clamps dt: a 3-second frame does not teleport the damped rig', () => {
    const cam = new PerspectiveCamera(35, 1, 1, 1e6);
    const sys = createCameraSystem(cam);
    sys.applyManualInput({ dAzimuthRad: 3, dElevationRad: 0, dLnRadius: 0 });
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
    sys.applyManualInput({ dAzimuthRad: 0, dElevationRad: 0, dLnRadius: -1 }); // zoom in one e-fold
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
