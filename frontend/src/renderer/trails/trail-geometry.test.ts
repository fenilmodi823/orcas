import { describe, expect, it } from 'vitest';
import { writeTrailBuffers, MIN_TRAIL_ALPHA } from './trail-geometry.js';

describe('writeTrailBuffers', () => {
  const rgb = { r: 0.1, g: 0.6, b: 0.3 };

  function ordered(n: number): Float32Array {
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      a[i * 3] = i;
      a[i * 3 + 1] = i * 2;
      a[i * 3 + 2] = 0;
    }
    return a;
  }

  it('copies positions unchanged', () => {
    const positions = new Float32Array(15);
    writeTrailBuffers(ordered(5), 5, rgb, positions, new Float32Array(20));
    expect([...positions]).toEqual([...ordered(5)]);
  });

  it('is dimmest at the oldest sample and brightest at the newest', () => {
    const colors = new Float32Array(40);
    writeTrailBuffers(ordered(10), 10, rgb, new Float32Array(30), colors);
    expect(colors[3]).toBeCloseTo(MIN_TRAIL_ALPHA, 5); // oldest, index 0
    expect(colors[9 * 4 + 3]).toBeCloseTo(1, 5); // newest, index 9
  });

  it('is monotonically increasing in alpha with age', () => {
    const colors = new Float32Array(40);
    writeTrailBuffers(ordered(10), 10, rgb, new Float32Array(30), colors);
    for (let i = 1; i < 10; i++) {
      expect(colors[i * 4 + 3]).toBeGreaterThan(colors[(i - 1) * 4 + 3]);
    }
  });

  it('carries the given rgb on every sample', () => {
    const colors = new Float32Array(40);
    writeTrailBuffers(ordered(10), 10, rgb, new Float32Array(30), colors);
    for (let i = 0; i < 10; i++) {
      expect(colors[i * 4]).toBeCloseTo(0.1);
      expect(colors[i * 4 + 1]).toBeCloseTo(0.6);
      expect(colors[i * 4 + 2]).toBeCloseTo(0.3);
    }
  });

  it('a single sample is fully bright, not dim', () => {
    const colors = new Float32Array(4);
    writeTrailBuffers(ordered(1), 1, rgb, new Float32Array(3), colors);
    expect(colors[3]).toBeCloseTo(1, 5);
  });

  it('throws if a target buffer is too small', () => {
    expect(() => writeTrailBuffers(ordered(3), 3, rgb, new Float32Array(6), new Float32Array(12))).toThrow(
      RangeError,
    );
    expect(() => writeTrailBuffers(ordered(3), 3, rgb, new Float32Array(9), new Float32Array(8))).toThrow(
      RangeError,
    );
  });
});
