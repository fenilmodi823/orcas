import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { bodyScreenPosition, earthBlocks, sphereBlocks } from './body-screen.js';

describe('earthBlocks', () => {
  it('is true straight through the planet', () => {
    expect(earthBlocks(new Vector3(42_000, 0, 0), new Vector3(-384_000, 0, 0))).toBe(true);
  });

  it('is false for a line that clears the limb', () => {
    expect(earthBlocks(new Vector3(42_000, 0, 0), new Vector3(-384_000, 0, 7_000 * 12))).toBe(false);
  });

  // The ellipsoid is 21 km flatter at the poles; a sphere of radius a would
  // wrongly block this line, which passes 10 km above the true pole.
  it('uses the ellipsoid, not a sphere', () => {
    const z = 6356.752 + 10;
    expect(earthBlocks(new Vector3(-50_000, 0, z), new Vector3(50_000, 0, z))).toBe(false);
  });

  it('is false when the target is in front of the planet', () => {
    expect(earthBlocks(new Vector3(42_000, 0, 0), new Vector3(20_000, 0, 0))).toBe(false);
  });
});

describe('sphereBlocks', () => {
  const moon = new Vector3(384_000, 0, 0);

  it('is true for a point behind the Moon, seen from the Earth', () => {
    expect(sphereBlocks(new Vector3(0, 0, 0), new Vector3(450_000, 0, 0), moon, 1737.4)).toBe(true);
  });

  it('is false for a point in front of the Moon', () => {
    expect(sphereBlocks(new Vector3(0, 0, 0), new Vector3(320_000, 0, 0), moon, 1737.4)).toBe(false);
  });

  it('is false for a line that passes beside it', () => {
    expect(sphereBlocks(new Vector3(0, 0, 0), new Vector3(450_000, 5_000, 0), moon, 1737.4)).toBe(false);
  });
});

describe('bodyScreenPosition', () => {
  const camera = new PerspectiveCamera(35, 2, 1, 1e7);
  camera.position.set(42_000, 0, 0);
  camera.up.set(0, 0, 1);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  it('centres a body straight ahead', () => {
    const p = bodyScreenPosition(new Vector3(-10, 0, 0), camera, 800, 400, { xPx: 0, yPx: 0, visible: false });
    expect(p.xPx).toBeCloseTo(400, 3);
    expect(p.yPx).toBeCloseTo(200, 3);
    expect(p.visible).toBe(false); // it is inside the Earth, so hidden
  });

  it('hides a body behind the camera', () => {
    const p = bodyScreenPosition(new Vector3(100_000, 0, 0), camera, 800, 400, { xPx: 0, yPx: 0, visible: true });
    expect(p.visible).toBe(false);
  });
});
