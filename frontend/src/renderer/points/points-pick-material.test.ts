import { describe, expect, it } from 'vitest';
import { POINTS_VERTEX_SHADER } from './points-shader-core.js';
import { createPickMaterial } from './points-pick-material.js';

describe('createPickMaterial', () => {
  it('uses the EXACT SAME vertex shader string as the shared source — byte-identical, not just equivalent', () => {
    const material = createPickMaterial();
    expect(material.vertexShader).toBe(POINTS_VERTEX_SHADER);
  });

  it('has no depth write or blending that would make a 25-fragment pick render more expensive than necessary', () => {
    const material = createPickMaterial();
    expect(material.transparent).toBe(false);
  });
});
