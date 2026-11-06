import { describe, expect, it } from 'vitest';
import { dashSegmentsFor } from './spacecraft-path-line.js';

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
});
