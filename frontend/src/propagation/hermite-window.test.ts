import { describe, expect, it } from 'vitest';
import { hermiteState, type Vec3 } from './hermite.js';
import { hermiteWindow, windowStart } from './hermite-window.js';

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

describe('hermiteWindow (SPK type 13 Hermite, S6a)', () => {
  it('with two states, is exactly the satellites’ cubic', () => {
    const p0 = { position: v(7000, -1200, 300), velocity: v(1.2, 7.4, -0.3) };
    const p1 = { position: v(7300, 3100, 150), velocity: v(-0.8, 7.1, -0.2) };
    const h = 600;
    for (const s of [0, 0.25, 0.5, 0.9, 1]) {
      const cubic = hermiteState(p0, p1, h, s);
      const window = hermiteWindow([0, h], [p0.position, p1.position], [p0.velocity, p1.velocity], s * h);
      for (const axis of ['x', 'y', 'z'] as const) {
        expect(window.position[axis]).toBeCloseTo(cubic.position[axis], 9);
        expect(window.velocity[axis]).toBeCloseTo(cubic.velocity[axis], 12);
      }
    }
  });

  it('with four states, reproduces a degree-7 polynomial and its derivative', () => {
    const c = [3, -1.5, 0.75, 2, -0.4, 0.1, -0.02, 0.003];
    const f = (t: number) => c.reduce((sum, a, i) => sum + a * t ** i, 0);
    const df = (t: number) => c.reduce((sum, a, i) => sum + i * a * t ** Math.max(i - 1, 0), 0);
    const times = [0, 1, 2.5, 4];
    const at = (g: (t: number) => number) => times.map((t) => v(g(t), 2 * g(t), -g(t)));
    const result = hermiteWindow(times, at(f), at(df), 1.7);
    expect(result.position.x).toBeCloseTo(f(1.7), 9);
    expect(result.position.y).toBeCloseTo(2 * f(1.7), 9);
    expect(result.velocity.z).toBeCloseTo(-df(1.7), 9);
  });

  it('centres the window on the interval and clamps it at both ends', () => {
    expect(windowStart(0, 4, 10)).toBe(0);
    expect(windowStart(4, 4, 10)).toBe(3);
    expect(windowStart(8, 4, 10)).toBe(6);
    expect(windowStart(3, 2, 10)).toBe(3);
  });
});
