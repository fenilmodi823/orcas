import { describe, expect, it } from 'vitest';
import { writePathBuffers, MIN_PATH_ALPHA } from './path-geometry.js';

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

  it('is brightest (alpha ~1) at the centre sample, dimmest at both ends', () => {
    const n = 181;
    const { colors } = run(n);
    const mid = (n - 1) / 2;
    expect(colors[mid * 4 + 3]).toBeCloseTo(1, 2);
    expect(colors[0 * 4 + 3]).toBeCloseTo(MIN_PATH_ALPHA, 2);
    expect(colors[(n - 1) * 4 + 3]).toBeCloseTo(MIN_PATH_ALPHA, 2);
    // rising toward the middle
    expect(colors[10 * 4 + 3]).toBeGreaterThan(colors[0 * 4 + 3]);
    expect(colors[(mid - 10) * 4 + 3]).toBeGreaterThan(colors[10 * 4 + 3]);
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
