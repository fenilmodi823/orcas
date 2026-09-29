import { describe, expect, it } from 'vitest';
import { viridis, viridisGlsl } from './viridis.js';

// matplotlib's five-class viridis: #440154 #3b528b #21918c #5ec962 #fde725.
const STOPS: [number, string][] = [
  [0, '440154'],
  [0.25, '3b528b'],
  [0.5, '21918c'],
  [0.75, '5ec962'],
  [1, 'fde725'],
];

describe('viridis', () => {
  it.each(STOPS)('matches the published stop at t = %s', (t, hex) => {
    const expected = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    viridis(t).forEach((channel, i) => expect(Math.abs(channel - expected[i])).toBeLessThan(0.02));
  });

  it('rises monotonically in lightness, so more always reads as more', () => {
    let previous = -Infinity;
    for (let t = 0; t <= 1; t += 0.05) {
      const [r, g, b] = viridis(t);
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      expect(luma).toBeGreaterThan(previous);
      previous = luma;
    }
  });

  it('generates GLSL from the same coefficients', () => {
    expect(viridisGlsl()).toContain('vec3(0.2777273272234177, 0.005407344544966578, 0.3340998053353061)');
  });
});
