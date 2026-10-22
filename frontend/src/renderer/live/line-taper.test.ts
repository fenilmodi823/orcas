import { describe, expect, it } from 'vitest';
import { LineGeometry, LineMaterial } from 'three-stdlib';
import { taperLine, taperVertexShader } from './line-taper.js';

describe("NASA's trail taper (S6b, Reference §4.3)", () => {
  it("scales each segment end's width by its own attribute, once", () => {
    const shader = new LineMaterial().vertexShader;
    const tapered = taperVertexShader(shader);
    expect(tapered).toContain('attribute float instanceWidthStart;');
    expect(tapered).toContain('offset *= linewidth * ( ( position.y < 0.5 ) ? instanceWidthStart : instanceWidthEnd );');
    expect(tapered).toContain('offset *= linewidth * 0.5;'); // the world-units branch is left alone
    expect(taperVertexShader(tapered)).toBe(tapered);
  });

  it('refuses a shader whose lines have changed, rather than draw untapered silently', () => {
    expect(() => taperVertexShader('void main() {}')).toThrow(/line-taper/);
  });

  it('runs from nothing at the oldest point to full width at the newest', () => {
    const geometry = new LineGeometry();
    geometry.setPositions(new Float32Array(5 * 3));
    const material = new LineMaterial();
    taperLine(material, geometry, 5);
    const start = geometry.getAttribute('instanceWidthStart');
    const end = geometry.getAttribute('instanceWidthEnd');
    expect(start.count).toBe(4);
    expect([start.getX(0), end.getX(0), start.getX(3), end.getX(3)]).toEqual([0, 0.25, 0.75, 1]);
    expect(material.vertexShader).toContain('instanceWidthEnd');
  });
});
