import { describe, expect, it } from 'vitest';
import { LOD_BAND_PX, tier0Alpha, tier1Alpha } from './lod-band.js';

describe('LOD band', () => {
  it('is the brief’s 3→6 px band', () => {
    expect(LOD_BAND_PX.loPx).toBe(3);
    expect(LOD_BAND_PX.hiPx).toBe(6);
  });

  it('is pure Tier 0 below the band and pure Tier 1 above it', () => {
    expect(tier0Alpha(0)).toBe(1);
    expect(tier1Alpha(0)).toBe(0);
    expect(tier0Alpha(100)).toBe(0);
    expect(tier1Alpha(100)).toBe(1);
  });

  // THE test for this milestone. Brief §B.6: both tiers blend additively
  // against a black sky, so a constant sum means the eye sees no event at
  // the crossover. A drifted constant breaks the sum — nothing else does.
  it('has alphas summing to exactly 1 at every pixel size', () => {
    for (let px = -1; px <= 12; px += 0.01) {
      expect(tier0Alpha(px) + tier1Alpha(px)).toBeCloseTo(1, 12);
    }
  });

  it('crosses at half intensity in the middle of the band', () => {
    const mid = (LOD_BAND_PX.loPx + LOD_BAND_PX.hiPx) / 2;
    expect(tier1Alpha(mid)).toBeCloseTo(0.5, 12);
  });

  it('is monotonic — Tier 1 never dims as an object gets closer', () => {
    let previous = -1;
    for (let px = 0; px <= 10; px += 0.05) {
      const alpha = tier1Alpha(px);
      expect(alpha).toBeGreaterThanOrEqual(previous);
      previous = alpha;
    }
  });
});
