import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import {
  clampElevation,
  createRig,
  DEFAULT_FOV_DEG,
  deriveAzElRadius,
  MAX_ELEVATION_RAD,
  rigCameraPosition,
} from './camera-rig.js';

describe('createRig', () => {
  it('starts level, identity frame, 35° FOV', () => {
    const rig = createRig();
    expect(rig.azimuthRad).toBe(0);
    expect(rig.elevationRad).toBe(0);
    expect(rig.rollRad).toBe(0);
    expect(rig.fovDeg).toBe(DEFAULT_FOV_DEG);
    expect(rig.frame.equals(new Quaternion())).toBe(true);
  });
});

describe('rigCameraPosition', () => {
  it('at az=0 el=0 identity frame, the camera sits at pivot + (radius, 0, 0) — an equatorial view', () => {
    const rig = createRig();
    rig.pivotKm.set(100, 200, 300);
    rig.radiusKm = 50;
    const out = rigCameraPosition(rig, new Vector3());
    expect(out.x).toBeCloseTo(150, 6);
    expect(out.y).toBeCloseTo(200, 6);
    expect(out.z).toBeCloseTo(300, 6);
  });

  it('at el=+π/2 the camera is over the +Z pole of the frame', () => {
    const rig = createRig();
    rig.radiusKm = 1000;
    rig.elevationRad = Math.PI / 2 - 1e-9;
    const out = rigCameraPosition(rig, new Vector3());
    expect(out.z).toBeCloseTo(1000, 3);
  });

  it('keeps |cameraPos − pivot| === radius for any azimuth/elevation', () => {
    const rig = createRig();
    rig.pivotKm.set(0, 0, 0);
    rig.radiusKm = 7000;
    for (const az of [0, 1, 2.5, -1.2]) {
      for (const el of [0, 0.5, -0.9, 1.2]) {
        rig.azimuthRad = az;
        rig.elevationRad = clampElevation(el);
        const p = rigCameraPosition(rig, new Vector3());
        expect(p.length()).toBeCloseTo(7000, 3);
      }
    }
  });

  it('writes into the provided out vector and returns it (zero-allocation contract)', () => {
    const rig = createRig();
    const out = new Vector3();
    expect(rigCameraPosition(rig, out)).toBe(out);
  });
});

describe('clampElevation', () => {
  it('never returns ±π/2 exactly — stops ε short to avoid gimbal flip', () => {
    expect(clampElevation(Math.PI)).toBeCloseTo(MAX_ELEVATION_RAD, 9);
    expect(clampElevation(-Math.PI)).toBeCloseTo(-MAX_ELEVATION_RAD, 9);
    expect(clampElevation(0.3)).toBe(0.3);
  });
});

describe('deriveAzElRadius', () => {
  it('round-trips: position → az/el/radius → position', () => {
    const rig = createRig();
    rig.pivotKm.set(-1000, 500, 2000);
    rig.frame.setFromAxisAngle(new Vector3(0, 1, 0), 0.7);
    rig.azimuthRad = 1.1;
    rig.elevationRad = -0.4;
    rig.radiusKm = 12000;
    const original = rigCameraPosition(rig, new Vector3());

    // scramble, then recover from the position alone
    rig.azimuthRad = 0;
    rig.elevationRad = 0;
    rig.radiusKm = 1;
    deriveAzElRadius(rig, original);

    const recovered = rigCameraPosition(rig, new Vector3());
    expect(recovered.distanceTo(original)).toBeLessThan(1e-3);
  });
});
