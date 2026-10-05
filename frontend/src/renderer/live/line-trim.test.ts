import { describe, expect, it } from 'vitest';
import { Matrix4 } from 'three';
import { LineMaterial } from 'three-stdlib';
import { patchLineMaterial, trimForReversedDepth } from './line-trim.js';

describe('the fat-line near trim under reversed depth (S4)', () => {
  it("finds three-stdlib's estimate to replace, so an upgrade cannot silently undo the fix", () => {
    const patched = trimForReversedDepth(new LineMaterial().vertexShader);
    expect(patched).toContain('#ifdef USE_REVERSED_DEPTH_BUFFER');
    expect(patched).toContain('- 0.5 * b / ( 1.0 + a )');
  });

  it('puts the trim between the camera plane and the near plane for both depth conventions', () => {
    const near = 1.8e6;
    const far = 2e10;
    for (const reversed of [false, true]) {
      const m = new Matrix4().makePerspective(-1, 1, 1, -1, near, far, undefined, reversed);
      const a = m.elements[10] ?? NaN; // projectionMatrix[2][2] in GLSL
      const b = m.elements[14] ?? NaN; // projectionMatrix[3][2]
      const estimate = reversed ? (-0.5 * b) / (1 + a) : (-0.5 * b) / a;
      expect(estimate).toBeLessThan(0);
      expect(estimate).toBeGreaterThan(-near);
    }
    // The bug: three-stdlib's formula on a reversed matrix trims at about -far/2.
    const reversed = new Matrix4().makePerspective(-1, 1, 1, -1, near, far, undefined, true);
    expect((-0.5 * (reversed.elements[14] ?? NaN)) / (reversed.elements[10] ?? NaN)).toBeCloseTo(-far / 2, -3);
  });

  it('patches a material once, however often it is asked', () => {
    const material = new LineMaterial();
    patchLineMaterial(material);
    const once = material.vertexShader;
    expect(once).toContain('USE_REVERSED_DEPTH_BUFFER');
    patchLineMaterial(material);
    expect(material.vertexShader).toBe(once);
  });
});
