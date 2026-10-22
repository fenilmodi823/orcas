import { describe, expect, it } from 'vitest';
import { ORBIT_SAMPLES, createFatLine, writeOrbitColours, writeOffsetPositions, writeSegments } from './orbit-line.js';
import { TRAIL_FLOOR } from '../paths/path-geometry.js';

describe('planet orbit lines (S4, NASA Eyes §4.3)', () => {
  it('are brightest at the planet and faintest on the far side, symmetrically', () => {
    const colours = new Float32Array(ORBIT_SAMPLES * 4);
    writeOrbitColours({ r: 0.2, g: 0.4, b: 0.6 }, colours);
    const alpha = (k: number) => colours[k * 4 + 3];
    const mid = (ORBIT_SAMPLES - 1) / 2;
    expect(alpha(0)).toBe(1);
    expect(alpha(ORBIT_SAMPLES - 1)).toBe(1);
    expect(alpha(mid)).toBeCloseTo(TRAIL_FLOOR, 6);
    for (let k = 1; k < mid; k++) {
      expect(alpha(k)).toBeLessThan(alpha(k - 1));
      expect(alpha(k)).toBeCloseTo(alpha(ORBIT_SAMPLES - 1 - k), 6);
    }
    expect([colours[4], colours[5], colours[6]]).toEqual([0.2, 0.4, 0.6].map(Math.fround));
  });

  it('keep metre precision near the camera, 1 AU from the Sun', () => {
    // A point on the Earth's orbit 1 AU from the Sun, the camera 1 km from it.
    const sunRelative = new Float64Array([149_597_870.7, 0.25, 0]);
    const sunMinusCamera = { x: -149_597_869.7, y: 0, z: 0 };
    const out = new Float32Array(3);
    writeOffsetPositions(sunRelative, 1, sunMinusCamera, out);
    expect(out[0]).toBeCloseTo(1, 6);
    expect(out[1]).toBeCloseTo(0.25, 6);
  });
});

describe('createFatLine (S4, shared with the moon trails in S6b)', () => {
  it('is depth-tested without writing depth, patched for reversed depth, and sized once', () => {
    const colours = new Float32Array(5 * 4).fill(1);
    const line = createFatLine(5, colours, 0.75, 1.2);
    expect(line.material.depthWrite).toBe(false);
    expect(line.material.opacity).toBe(0.75);
    expect(line.material.linewidth).toBe(1.2);
    expect(line.material.vertexShader).toContain('USE_REVERSED_DEPTH_BUFFER');
    expect(line.frustumCulled).toBe(false);
    const points = Float32Array.from({ length: 15 }, (_, i) => i);
    writeSegments(line.geometry, points, 5);
    const start = line.geometry.getAttribute('instanceStart');
    expect([start.getX(1), start.getY(1), start.getZ(1)]).toEqual([3, 4, 5]); // the second segment starts at point 1
  });
});
