import { BoxGeometry, BufferAttribute, BufferGeometry, Matrix4 } from 'three';

/**
 * The Tier 1 proxy silhouette: a bus with two solar wings and a nub on the
 * Earth-facing end.
 *
 * ⭐ Why not the octahedron it replaces. `octahedronGeometry(1, 0)` is
 * regular, so it looks identical from every angle — the nadir pose
 * lvlh-pose.ts computes was applied and unit-tested but could not be
 * confirmed by eye, and the shape read as "a rock", not "a satellite".
 * This is the smallest geometry that fixes both: the wings give a long
 * axis, and the nub makes one END distinguishable so "this face looks at
 * Earth" is legible.
 *
 * ⚠️ This is a SILHOUETTE, not a model. No catalogue object's real
 * dimensions are known here (see object-extents.ts) and none are implied.
 * Every proxy is the same shape at the same assumed size; Tier 2's real
 * glTF models are a separate, later job.
 *
 * Local frame: **+Y is nadir** — lvlh-pose.ts rotates local +Y onto the
 * direction pointing at Earth's centre. Wings run along ±X.
 *
 * Bounding radius is <= 1 by construction, because Tier1Objects scales this
 * by TIER1_PROXY_SCALE_KM and the LOD band thresholds on that same assumed
 * extent. A vertex outside the unit sphere would draw the proxy bigger than
 * the promotion maths claimed — tier1-write.test.ts pins the relationship.
 *
 * 48 triangles (4 boxes). At the 2,000-instance cap that is 96k triangles
 * worst case, against a realistic membership of 0-6.
 */

interface Part {
  readonly size: readonly [number, number, number];
  readonly at: readonly [number, number, number];
}

const PARTS: readonly Part[] = [
  { size: [0.3, 0.52, 0.3], at: [0, 0, 0] }, // bus, elongated along the nadir axis
  { size: [0.14, 0.16, 0.14], at: [0, 0.32, 0] }, // Earth-facing nub — the asymmetry that reads as "down"
  { size: [0.62, 0.02, 0.34], at: [0.66, 0, 0] }, // wing +X
  { size: [0.62, 0.02, 0.34], at: [-0.66, 0, 0] }, // wing -X
];

/**
 * Build the proxy geometry. Caller owns it and must `dispose()`.
 *
 * Merged by hand rather than with `BufferGeometryUtils.mergeGeometries`:
 * that lives under `three/examples/jsm`, which ships no type declarations
 * in this version, and importing it would need an `any` or a hand-written
 * `.d.ts` for twenty lines of array concatenation.
 */
export function createSatelliteProxyGeometry(): BufferGeometry {
  const matrix = new Matrix4();
  const parts = PARTS.map(({ size, at }) => {
    const box = new BoxGeometry(size[0], size[1], size[2]).toNonIndexed();
    box.applyMatrix4(matrix.makeTranslation(at[0], at[1], at[2]));
    return box;
  });

  const vertexCount = parts.reduce((n, g) => n + g.getAttribute('position').count, 0);
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);

  let offset = 0;
  for (const part of parts) {
    positions.set(part.getAttribute('position').array as Float32Array, offset);
    normals.set(part.getAttribute('normal').array as Float32Array, offset);
    offset += part.getAttribute('position').count * 3;
    part.dispose();
  }

  const merged = new BufferGeometry();
  merged.setAttribute('position', new BufferAttribute(positions, 3));
  merged.setAttribute('normal', new BufferAttribute(normals, 3));
  merged.computeBoundingSphere();
  return merged;
}
