import { describe, expect, it } from 'vitest';
import { AU_KM } from '@orcas/physics';
import { sunSpriteSize } from './sun-sprite.js';

describe('sunSpriteSize (S4: the disc sized by distance)', () => {
  it("draws the Sun's true disc from 1 AU: 0.533° across", () => {
    const { spritePx, discFraction } = sunSpriteSize(AU_KM, 35, 900);
    expect(spritePx * discFraction).toBeCloseTo((0.533 / 35) * 900, 1);
  });

  it('halves the disc at twice the distance', () => {
    const near = sunSpriteSize(2 * AU_KM, 35, 900);
    expect(near.spritePx * near.discFraction).toBeCloseTo((0.533 / 70) * 900, 1);
  });

  it('keeps a 3 px disc from the edge of the Solar System, where the true one is a fraction of a pixel', () => {
    const far = sunSpriteSize(100 * AU_KM, 35, 900);
    expect(far.spritePx * far.discFraction).toBe(3);
  });
});
