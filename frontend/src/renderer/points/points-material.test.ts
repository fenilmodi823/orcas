import { describe, expect, it } from 'vitest';
import { createPointsMaterial, FLOOR_CORE_BRIGHTNESS, FLOOR_CORE_RADIUS_PX } from './points-material.js';
import { createPickMaterial } from './points-pick-material.js';

describe('the Tier 0 display material', () => {
  it('converts its output to the screen colour space, like every other scene material', () => {
    expect(createPointsMaterial().fragmentShader).toContain('#include <colorspace_fragment>');
  });
  it('passes the core values as uniforms, never literals in the GLSL', () => {
    const m = createPointsMaterial();
    expect(m.uniforms.uFloorCoreBrightness?.value).toBe(FLOOR_CORE_BRIGHTNESS);
    expect(m.uniforms.uFloorCoreRadiusPx?.value).toBe(FLOOR_CORE_RADIUS_PX);
    expect(m.fragmentShader).not.toContain('0.75');
  });
  it('never converts the pick pass, whose RGB is an entity id', () => {
    expect(createPickMaterial().fragmentShader).not.toContain('colorspace_fragment');
  });
});
