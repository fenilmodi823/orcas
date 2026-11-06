import { describe, expect, it } from 'vitest';
import { createPathLine, dashSegmentsFor } from './spacecraft-path-line.js';
import { SEGMENT_FLOWN, SEGMENT_PREDICTED } from './spacecraft-trail.js';

describe('dashSegmentsFor', () => {
  it('keeps one segment a dash once a segment is 8 px or longer', () => {
    expect(dashSegmentsFor(10, 1)).toBe(1);
    expect(dashSegmentsFor(8, 1)).toBe(1);
  });
  it("groups sub-pixel segments into ~8 px dashes, a power of 2: Voyager 1's System view", () => {
    // 0.034 AU a segment at ~1.16 px per AU is 0.04 px: 256 segments make a 10 px dash.
    const n = dashSegmentsFor(0.034 * 1.496e8, 1.16 / 1.496e8);
    expect(n).toBe(256);
    expect(n * 0.034 * 1.16).toBeGreaterThanOrEqual(8);
  });
  it('falls back to 1 with no predicted segment and caps the grouping', () => {
    expect(dashSegmentsFor(0, 1)).toBe(1);
    expect(dashSegmentsFor(1e-12, 1)).toBe(4096);
  });
  it('rewrites the dashes on a rebuild even when the zoom has not changed', () => {
    const path = createPathLine({ r: 1, g: 1, b: 1 }, 2);
    const count = 64;
    const points = new Float64Array(count * 3).map((_, i) => (i % 3 === 0 ? i * 100 : 0));
    const origin = { x: 0, y: 0, z: 0 };
    const alphas = () => {
      const a = (path.line.geometry.getAttribute('instanceColorStart') as unknown as { data: { array: Float32Array } }).data.array;
      return Array.from({ length: count - 1 }, (_, i) => a[i * 8 + 3]!);
    };
    path.rebuild(new Uint8Array(count - 1).fill(SEGMENT_PREDICTED), count, points);
    path.place(points, count, origin, origin, 1);
    expect(alphas().some((a) => a === 0)).toBe(true);
    path.rebuild(new Uint8Array(count - 1).fill(SEGMENT_FLOWN), count, points);
    path.place(points, count, origin, origin, 1);
    expect(alphas().every((a) => a > 0)).toBe(true);
  });
});
