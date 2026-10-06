import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { clampNearToBodies } from './near-clamp.js';

describe('clampNearToBodies (S4)', () => {
  const jupiter = { centreKm: new Vector3(7.8e8, 0, 0), radiusKm: 69_911 };

  it('pulls the near plane in when a planet is closer than the Earth-based near plane allows', () => {
    // Zoomed out 5 AU, Jupiter 1 million km away: the Earth term would set near ~3.7e8 km.
    const camera = new PerspectiveCamera(35, 1, 3.7e8, 1e10);
    camera.position.set(7.8e8 + 1e6, 0, 0);
    clampNearToBodies(camera, [jupiter]);
    expect(camera.near).toBeCloseTo(0.5 * (1e6 - 69_911), 0);
    expect(camera.projectionMatrix.elements[14]).not.toBe(new PerspectiveCamera(35, 1, 3.7e8, 1e10).projectionMatrix.elements[14]);
  });

  it('leaves a nearer near plane alone, and ignores a body the camera is inside', () => {
    const camera = new PerspectiveCamera(35, 1, 100, 1e10);
    camera.position.set(7.8e8 + 1e6, 0, 0);
    clampNearToBodies(camera, [jupiter]);
    expect(camera.near).toBe(100);
    camera.position.copy(jupiter.centreKm);
    clampNearToBodies(camera, [jupiter]);
    expect(camera.near).toBe(100);
  });
});

describe('clampNearToBodies: another surface (S5b)', () => {
  it('pulls near inside Saturn’s rings when they are nearer than any body', () => {
    const camera = new PerspectiveCamera(35, 1, 20_000, 1e10);
    camera.position.set(1e9, 0, 0);
    clampNearToBodies(camera, [{ centreKm: new Vector3(1e9 + 1e5, 0, 0), radiusKm: 58_232 }], 1_000);
    expect(camera.near).toBe(500);
  });
});
