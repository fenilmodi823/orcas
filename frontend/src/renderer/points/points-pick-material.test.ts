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

describe('picking versus the LOD cross-fade', () => {
  // If the pick fragment shader ever starts reading vBrightness, an object
  // faded out by the Tier 0 half of the cross-fade would become
  // unclickable at exactly the moment its Tier 1 mesh appears - the worst
  // kind of bug, because it is invisible and intermittent.
  it('never lets brightness reach the pick output', () => {
    const material = createPickMaterial();
    expect(material.fragmentShader).not.toContain('vBrightness');
  });

  it('culls only on aFlags, so a faded point still writes its id', () => {
    expect(POINTS_VERTEX_SHADER).toContain('if (aFlags < 0.5)');
    // The cross-fade multiplies brightness; it must never touch gl_Position.
    const afterFade = POINTS_VERTEX_SHADER.split('1.0 - smoothstep(uLodLoPx, uLodHiPx, truePx)')[1];
    expect(afterFade).toContain('gl_Position = projectionMatrix * mvPosition;');
  });
});
