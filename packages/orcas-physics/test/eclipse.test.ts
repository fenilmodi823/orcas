import { describe, expect, it } from 'vitest';
import { AU_KM, SUN_RADIUS_KM, WGS84_A_KM, sunlitFraction, visibleDiskFraction } from '../src/index.js';

const SUN = { x: AU_KM, y: 0, z: 0 }; // Sun on +x, one AU away

describe('sunlitFraction — conical Earth shadow', () => {
  it('is 1 on the sunward side', () => {
    expect(sunlitFraction({ x: 7000, y: 0, z: 0 }, SUN)).toBe(1);
  });

  it('is 1 beside the Earth, outside the shadow', () => {
    expect(sunlitFraction({ x: 0, y: 7000, z: 0 }, SUN)).toBe(1);
  });

  it('is 0 directly behind the Earth in LEO and at GEO (both inside the umbra)', () => {
    expect(sunlitFraction({ x: -7000, y: 0, z: 0 }, SUN)).toBe(0);
    expect(sunlitFraction({ x: -42_164, y: 0, z: 0 }, SUN)).toBe(0);
  });

  it('rises monotonically from 0 to 1 across the shadow edge, through a real penumbra', () => {
    const values: number[] = [];
    for (let y = 6000; y <= 6800; y += 10) values.push(sunlitFraction({ x: -3000, y, z: 0 }, SUN));
    expect(values[0]).toBe(0);
    expect(values[values.length - 1]).toBe(1);
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThanOrEqual(values[i - 1] ?? 0);
    expect(values.some((v) => v > 0.01 && v < 0.99)).toBe(true);
  });

  it('stays inside [0, 1]', () => {
    for (let k = 0; k < 200; k++) {
      const ang = (k / 200) * 2 * Math.PI;
      const r = 6500 + k * 180;
      const f = sunlitFraction({ x: r * Math.cos(ang), y: r * Math.sin(ang), z: 300 }, SUN);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });

  it('uses the stated radii', () => {
    expect(SUN_RADIUS_KM).toBe(695_700);
    expect(WGS84_A_KM).toBeCloseTo(6378.137, 3);
  });
});

describe('visibleDiskFraction — overlap geometry', () => {
  /** Independent check: count grid points of the Sun's disk not covered by the Earth's. */
  function numeric(a: number, b: number, c: number, n = 1200): number {
    let inSun = 0;
    let visible = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const u = -a + (2 * a * (i + 0.5)) / n;
        const v = -a + (2 * a * (j + 0.5)) / n;
        if (u * u + v * v > a * a) continue;
        inSun++;
        if ((u - c) ** 2 + v * v > b * b) visible++;
      }
    }
    return visible / inSun;
  }

  it('matches numerical integration for partial overlaps', () => {
    for (const [a, b, c] of [
      [0.0047, 0.9, 0.9],
      [0.0047, 0.9, 0.9035],
      [1, 0.6, 1.1],
    ] as const) {
      expect(visibleDiskFraction(a, b, c)).toBeCloseTo(numeric(a, b, c), 2);
    }
  });

  it('handles no overlap, total and annular eclipses', () => {
    expect(visibleDiskFraction(0.1, 0.5, 0.7)).toBe(1);
    expect(visibleDiskFraction(0.1, 0.5, 0.3)).toBe(0);
    expect(visibleDiskFraction(0.5, 0.1, 0.2)).toBeCloseTo(1 - 0.04, 12);
  });
});
