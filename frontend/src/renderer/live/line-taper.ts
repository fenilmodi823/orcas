import { InstancedBufferAttribute } from 'three';
import type { LineGeometry, LineMaterial } from 'three-stdlib';

const AFTER = 'attribute vec3 instanceEnd;';
const DECLARE = `${AFTER}
	attribute float instanceWidthStart;
	attribute float instanceWidthEnd;`;
/** The screen-space branch's width line; the world-units branch reads `linewidth * 0.5` and is left alone. */
const WIDTH = 'offset *= linewidth;';
const TAPERED = 'offset *= linewidth * ( ( position.y < 0.5 ) ? instanceWidthStart : instanceWidthEnd );';

/**
 * NASA Eyes' trail tapers from nothing at its oldest point to its full width at the body (`widthMin` 0 →
 * `widthMax`, Reference §4.3); three-stdlib's `LineMaterial` draws one width. Scale each segment end by a
 * per-segment attribute. Idempotent; throws if the library's lines have changed, as `trimForReversedDepth` does.
 */
export function taperVertexShader(vertexShader: string): string {
  if (vertexShader.includes(TAPERED)) return vertexShader;
  if (!vertexShader.includes(AFTER) || !vertexShader.includes(WIDTH)) {
    throw new Error('LineMaterial no longer has the lines line-taper.ts patches.');
  }
  return vertexShader.replace(AFTER, DECLARE).replace(WIDTH, TAPERED);
}

/**
 * Taper a line whose points run oldest first: the material patched, the geometry given widths 0 → 1 along its
 * `points` (S6b moon trails). Only for lines that have both: an unbound attribute would read 0, a line of no width.
 */
export function taperLine(material: LineMaterial, geometry: LineGeometry, points: number): void {
  const patched = taperVertexShader(material.vertexShader);
  if (patched !== material.vertexShader) {
    material.vertexShader = patched;
    material.needsUpdate = true;
  }
  const segments = points - 1;
  const start = new Float32Array(segments);
  const end = new Float32Array(segments);
  for (let i = 0; i < segments; i++) {
    start[i] = i / segments;
    end[i] = (i + 1) / segments;
  }
  geometry.setAttribute('instanceWidthStart', new InstancedBufferAttribute(start, 1));
  geometry.setAttribute('instanceWidthEnd', new InstancedBufferAttribute(end, 1));
}
