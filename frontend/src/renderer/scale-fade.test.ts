import { describe, expect, it } from 'vitest';
import { layerFade, MOON_LAYER_RADIUS_KM, SATELLITE_LAYER_RADIUS_KM } from './scale-fade.js';

describe('layerFade (S4, B.21)', () => {
  it('fades the satellites out between 2 and 8 million km', () => {
    expect(layerFade(SATELLITE_LAYER_RADIUS_KM, 42_164)).toBe(1);
    expect(layerFade(SATELLITE_LAYER_RADIUS_KM, 2e6)).toBe(1);
    expect(layerFade(SATELLITE_LAYER_RADIUS_KM, 4e6)).toBeCloseTo(0.5, 9);
    expect(layerFade(SATELLITE_LAYER_RADIUS_KM, 8e6)).toBe(0);
    expect(layerFade(SATELLITE_LAYER_RADIUS_KM, 1.5e10)).toBe(0);
  });

  it('keeps a larger layer, the Moon trail, until it is as small on screen', () => {
    expect(layerFade(MOON_LAYER_RADIUS_KM, 8e6)).toBe(1);
    const ratio = MOON_LAYER_RADIUS_KM / SATELLITE_LAYER_RADIUS_KM;
    expect(layerFade(MOON_LAYER_RADIUS_KM, 4e6 * ratio)).toBeCloseTo(0.5, 9);
  });
});
