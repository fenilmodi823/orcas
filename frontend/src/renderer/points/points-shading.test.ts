import { describe, expect, it } from 'vitest';
import { apparentPx, computePointShading } from './points-shading.js';

describe('computePointShading', () => {
  it('draws at true apparent size when it is above the legibility floor', () => {
    // radius 1km at distance 1000km, 1000 px per radian of FOV →
    // true angular radius = 1/1000 rad → truePx = 1.
    const { drawPx } = computePointShading(1, 1000, 1000, 0.5, 1, 0);
    expect(drawPx).toBeCloseTo(1, 6);
  });

  it('floors draw size at uMinPointPx without floor ever shrinking it', () => {
    const { drawPx } = computePointShading(0.001, 1000, 1000, 1.5, 1, 0);
    expect(drawPx).toBe(1.5);
  });

  it("a point drawn at 4x true size comes out at 1/16 brightness — the brief's own worked example", () => {
    // Choose distance so truePx = 0.5, then floor forces drawPx = 2 (4x).
    const { brightness } = computePointShading(0.5, 1000, 1000, 2, 1, 0);
    expect(brightness).toBeCloseTo(1 / 16, 6);
  });

  it('never returns brightness below the floor, however small the object', () => {
    const { brightness } = computePointShading(0.0000001, 1_000_000, 1000, 5, 1, 0.05);
    expect(brightness).toBeGreaterThanOrEqual(0.05);
  });

  it('brightness never exceeds baseBrightness even at true size', () => {
    const { brightness } = computePointShading(10, 10, 1000, 0.5, 1, 0);
    expect(brightness).toBeLessThanOrEqual(1);
  });
});

describe('apparentPx', () => {
  it('is the small-angle law the vertex shader uses: r * pxPerRad / d', () => {
    expect(apparentPx(0.01, 100, 1188)).toBeCloseTo(0.1188, 10);
  });

  it('halves when the distance doubles', () => {
    expect(apparentPx(0.01, 200, 1188)).toBeCloseTo(apparentPx(0.01, 100, 1188) / 2, 12);
  });

  // Guards the divide. A zero distance means the camera is inside the
  // object; returning Infinity would propagate NaN through smoothstep.
  it('clamps a zero or negative distance instead of dividing by it', () => {
    expect(Number.isFinite(apparentPx(0.01, 0, 1188))).toBe(true);
    expect(apparentPx(0.01, 0, 1188)).toBeGreaterThan(0);
  });

  it('agrees with computePointShading, which must not keep its own copy', () => {
    const px = apparentPx(0.01, 3.96, 1188);
    const shading = computePointShading(0.01, 3.96, 1188, 1.5, 1.0, 0.6);
    expect(shading.drawPx).toBeCloseTo(Math.max(px, 1.5), 12);
  });
});
