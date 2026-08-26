import { describe, expect, it } from 'vitest';
import { computePointShading } from './points-shading.js';

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
