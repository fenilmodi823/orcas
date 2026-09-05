import { describe, expect, it } from 'vitest';
import { POINTS_VERTEX_SHADER, PICK_LAYER } from './points-shader-core.js';

describe('POINTS_VERTEX_SHADER', () => {
  it('declares and writes vEntityId, so the pick fragment shader can read it', () => {
    expect(POINTS_VERTEX_SHADER).toContain('varying float vEntityId;');
    expect(POINTS_VERTEX_SHADER).toContain('vEntityId = aEntityId;');
  });

  it('is a single non-empty string (sanity check against an empty extraction mistake)', () => {
    expect(typeof POINTS_VERTEX_SHADER).toBe('string');
    expect(POINTS_VERTEX_SHADER.length).toBeGreaterThan(100);
  });
});

describe('PICK_LAYER', () => {
  it('is a layer index other than the default layer 0', () => {
    expect(PICK_LAYER).toBeGreaterThan(0);
  });
});

describe('Tier 0 regime colour at rest (P4.D23/24)', () => {
  it('declares the regime colour lookup and the selection accent', () => {
    expect(POINTS_VERTEX_SHADER).toContain('uniform vec3 uRegimeColors[5];');
    expect(POINTS_VERTEX_SHADER).toContain('uniform vec3 uSelectedColor;');
  });

  it('declares and writes vTint, so the display fragment shader can read it', () => {
    expect(POINTS_VERTEX_SHADER).toContain('varying vec3 vTint;');
    expect(POINTS_VERTEX_SHADER).toContain('vTint = mix(uRegimeColors[int(aRegime)], uSelectedColor, isSelected);');
  });
});

describe('Tier 0 cross-fade', () => {
  it('declares the band uniforms', () => {
    expect(POINTS_VERTEX_SHADER).toContain('uniform float uLodLoPx;');
    expect(POINTS_VERTEX_SHADER).toContain('uniform float uLodHiPx;');
  });

  it('fades brightness out across the band using truePx', () => {
    expect(POINTS_VERTEX_SHADER).toContain('1.0 - smoothstep(uLodLoPx, uLodHiPx, truePx)');
  });

  // Brief §F.7: the constants must reach the shader as uniforms. A literal
  // 3.0 or 6.0 in the GLSL is exactly the drift this milestone prevents.
  it('never hard-codes the band values into the shader source', () => {
    expect(POINTS_VERTEX_SHADER).not.toContain('smoothstep(3.0');
    expect(POINTS_VERTEX_SHADER).not.toContain('smoothstep(6.0');
  });
});
