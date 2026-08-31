import { describe, expect, it } from 'vitest';
import { instanceBrightness, TIER1_PROXY_SCALE_KM } from './tier1-write.js';
import { PLACEHOLDER_RADIUS_KM } from '../object-extents.js';
import { tier0Alpha } from '../lod/lod-band.js';
import { apparentPx } from '../points/points-shading.js';

const PX_PER_RAD = 1188;
const b = (d: number) => instanceBrightness(d, PX_PER_RAD, PLACEHOLDER_RADIUS_KM);

describe('instanceBrightness', () => {
  it('is dark below the band, so nothing pops in', () => {
    expect(b(100)).toBe(0);
  });

  it('is full once inside object-mode framing distance (~0.0825 km)', () => {
    expect(b(0.0825)).toBeCloseTo(1, 6);
  });

  it('is half in the middle of the band', () => {
    expect(b((0.01 * PX_PER_RAD) / 4.5)).toBeCloseTo(0.5, 6);
  });

  // THE cross-fade invariant, expressed against real distances rather than
  // raw pixel numbers - brief §B.6's "sum of intensity stays constant".
  it('sums to 1 with the Tier 0 term at every distance', () => {
    for (let d = 0.05; d < 50; d *= 1.05) {
      const px = apparentPx(PLACEHOLDER_RADIUS_KM, d, PX_PER_RAD);
      expect(b(d) + tier0Alpha(px)).toBeCloseTo(1, 12);
    }
  });

  it('scales the proxy at the same extent the promotion maths assumed', () => {
    expect(TIER1_PROXY_SCALE_KM).toBe(PLACEHOLDER_RADIUS_KM);
  });
});
