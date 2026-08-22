import { describe, expect, it } from 'vitest';
import { hermiteState, type HermiteEndpoint } from './hermite.js';

describe('hermiteState', () => {
  it('reproduces p0 exactly at s=0', () => {
    const p0: HermiteEndpoint = { position: { x: 1, y: 2, z: 3 }, velocity: { x: 0.1, y: 0.2, z: 0.3 } };
    const p1: HermiteEndpoint = { position: { x: 10, y: 20, z: 30 }, velocity: { x: 0.4, y: 0.5, z: 0.6 } };
    const out = hermiteState(p0, p1, 60, 0);
    expect(out).toEqual(p0);
  });

  it('reproduces p1 exactly at s=1', () => {
    const p0: HermiteEndpoint = { position: { x: 1, y: 2, z: 3 }, velocity: { x: 0.1, y: 0.2, z: 0.3 } };
    const p1: HermiteEndpoint = { position: { x: 10, y: 20, z: 30 }, velocity: { x: 0.4, y: 0.5, z: 0.6 } };
    const out = hermiteState(p0, p1, 60, 1);
    expect(out.position.x).toBeCloseTo(p1.position.x, 10);
    expect(out.position.y).toBeCloseTo(p1.position.y, 10);
    expect(out.position.z).toBeCloseTo(p1.position.z, 10);
    expect(out.velocity.x).toBeCloseTo(p1.velocity.x, 10);
  });

  it('reproduces a cubic polynomial exactly at an interior point', () => {
    // Cubic Hermite interpolation of a degree-3 polynomial is exact —
    // a standard property, and a much stronger check than boundary
    // conditions alone. f(t) = 2 + 3t - t^2 + 0.5t^3, f'(t) = 3 - 2t + 1.5t^2.
    const f = (t: number) => 2 + 3 * t - t ** 2 + 0.5 * t ** 3;
    const fPrime = (t: number) => 3 - 2 * t + 1.5 * t ** 2;
    const t0 = 2;
    const t1 = 9;
    const h = t1 - t0;
    const p0: HermiteEndpoint = {
      position: { x: f(t0), y: f(t0), z: f(t0) },
      velocity: { x: fPrime(t0), y: fPrime(t0), z: fPrime(t0) },
    };
    const p1: HermiteEndpoint = {
      position: { x: f(t1), y: f(t1), z: f(t1) },
      velocity: { x: fPrime(t1), y: fPrime(t1), z: fPrime(t1) },
    };

    for (const s of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const t = t0 + s * h;
      const out = hermiteState(p0, p1, h, s);
      expect(out.position.x).toBeCloseTo(f(t), 9);
      expect(out.velocity.x).toBeCloseTo(fPrime(t), 9);
    }
  });
});
