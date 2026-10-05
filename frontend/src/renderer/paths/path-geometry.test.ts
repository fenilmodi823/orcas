import { describe, expect, it } from 'vitest';
import { TRAIL_FLOOR, writePathBuffers } from './path-geometry.js';

function ring(n: number): Float32Array {
  // n points on a circle of radius 7000 in the XY plane
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * Math.PI * 2;
    a[i * 3] = Math.cos(t) * 7000;
    a[i * 3 + 1] = Math.sin(t) * 7000;
    a[i * 3 + 2] = 0;
  }
  return a;
}

describe('writePathBuffers', () => {
  const rgb = { r: 0.2, g: 0.4, b: 0.9 };

  function run(n: number) {
    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 4);
    writePathBuffers(ring(n), n, rgb, positions, colors);
    return { positions, colors };
  }

  it('copies the sampled km coordinates into positions unchanged', () => {
    const src = ring(5);
    const positions = new Float32Array(15);
    writePathBuffers(src, 5, rgb, positions, new Float32Array(20));
    for (let i = 0; i < 15; i++) expect(positions[i]).toBeCloseTo(src[i], 3);
  });

  it('writes RGBA per point, carrying the given rgb', () => {
    const { colors } = run(10);
    for (let i = 0; i < 10; i++) {
      expect(colors[i * 4]).toBeCloseTo(0.2);
      expect(colors[i * 4 + 1]).toBeCloseTo(0.4);
      expect(colors[i * 4 + 2]).toBeCloseTo(0.9);
    }
  });

  // NASA Eyes' trail (Reference - NASA Eyes §4.3): brightest at the object,
  // fading back along the path it came from, faintest just ahead of it.
  it('is brightest at "now" and faintest just ahead of the object, at the floor', () => {
    const n = 181;
    const { colors } = run(n);
    const mid = (n - 1) / 2;
    expect(colors[mid * 4 + 3]).toBeCloseTo(1, 6);
    expect(colors[(mid + 1) * 4 + 3]).toBeCloseTo(TRAIL_FLOOR, 1);
    for (let i = 0; i < n; i++) expect(colors[i * 4 + 3]).toBeGreaterThanOrEqual(TRAIL_FLOOR - 1e-6);
  });

  it('fades steadily going back in time, round the whole orbit', () => {
    const n = 181;
    const { colors } = run(n);
    const mid = (n - 1) / 2;
    const a = (i: number) => colors[i * 4 + 3];
    // Behind "now", back to the trailing half-orbit point...
    expect(a(mid - 10)).toBeLessThan(a(mid));
    expect(a(0)).toBeLessThan(a(mid - 10));
    // ...which is the same place as the leading half-orbit point, so the
    // ring has no seam there...
    expect(a(n - 1)).toBeCloseTo(a(0), 6);
    // ...and on round to just ahead of the object, the oldest part of the trail.
    expect(a(mid + 10)).toBeLessThan(a(n - 1));
    expect(a(mid + 1)).toBeLessThan(a(mid + 10));
  });

  it('throws if a target buffer is too small', () => {
    expect(() => writePathBuffers(ring(3), 3, rgb, new Float32Array(6), new Float32Array(12))).toThrow(
      RangeError,
    );
    expect(() => writePathBuffers(ring(3), 3, rgb, new Float32Array(9), new Float32Array(8))).toThrow(
      RangeError,
    );
  });
});
