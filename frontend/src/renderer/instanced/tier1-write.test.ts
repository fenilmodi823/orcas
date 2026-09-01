import { describe, expect, it } from 'vitest';
import { Color, InstancedMesh, Matrix4, MeshStandardMaterial, OctahedronGeometry, Quaternion, Vector3 } from 'three';
import { instanceBrightness, TIER1_PROXY_SCALE_KM, writeTier1Instances } from './tier1-write.js';
import { PLACEHOLDER_RADIUS_KM } from '../object-extents.js';
import { LOD_BAND_PX, tier0Alpha } from '../lod/lod-band.js';
import { apparentPx } from '../points/points-shading.js';

const PX_PER_RAD = 1188;
const b = (d: number) => instanceBrightness(d, PX_PER_RAD, PLACEHOLDER_RADIUS_KM);

describe('instanceBrightness', () => {
  it('is dark below the band, so nothing pops in', () => {
    expect(b(100)).toBe(0);
  });

  it('is full once inside object-mode framing distance (~0.0825 km)', () => {
    expect(b(0.0825)).toBeCloseTo(1, 6);
  });

  it('is half in the middle of the band', () => {
    expect(b((0.01 * PX_PER_RAD) / 4.5)).toBeCloseTo(0.5, 6);
  });

  // THE cross-fade invariant, expressed against real distances rather than
  // raw pixel numbers - brief §B.6's "sum of intensity stays constant".
  it('sums to 1 with the Tier 0 term at every distance', () => {
    for (let d = 0.05; d < 50; d *= 1.05) {
      const px = apparentPx(PLACEHOLDER_RADIUS_KM, d, PX_PER_RAD);
      expect(b(d) + tier0Alpha(px)).toBeCloseTo(1, 12);
    }
  });

  it('scales the proxy at the same extent the promotion maths assumed', () => {
    expect(TIER1_PROXY_SCALE_KM).toBe(PLACEHOLDER_RADIUS_KM);
  });
});

describe('writeTier1Instances — camera-relative origin', () => {
  function harness(objectKm: [number, number, number], camKm: [number, number, number]) {
    const mesh = new InstancedMesh(new OctahedronGeometry(1, 0), new MeshStandardMaterial(), 4);
    const frame = {
      positions: new Float32Array(objectKm),
      velocities: new Float32Array([0, 7.6, 0]),
      epochMs: 0,
      count: 1,
      generation: 0,
      flags: new Uint8Array(1),
    } as unknown as Parameters<typeof writeTier1Instances>[0]['frame'];
    const camPosKm = new Vector3(...camKm);
    writeTier1Instances({
      mesh,
      frame,
      members: new Uint32Array([0]),
      memberCount: 1,
      camPosKm,
      pixelsPerRadian: PX_PER_RAD,
      tint: new Color(1, 1, 1),
      band: LOD_BAND_PX,
    });
    const local = new Matrix4();
    mesh.getMatrixAt(0, local);
    return { mesh, camPosKm, translation: new Vector3().setFromMatrixPosition(local) };
  }

  // The M1.7a review's defect (b). A LEO object sits ~7,000 km from the
  // origin; float32 quantises that to ~0.4 m, which is ~6 px of shimmer at
  // the 82 m the fly-to arrives at. Writing offsets instead keeps every
  // float32 value near zero.
  it('writes small offsets, never absolute world positions', () => {
    const { translation } = harness([2745.3, -5986.5, 1672.3], [2745.35, -5986.5, 1672.3]);
    expect(translation.length()).toBeLessThan(1);
  });

  it('still places the instance at its true world position', () => {
    const { mesh, camPosKm, translation } = harness([2745.3, -5986.5, 1672.3], [2745.35, -5986.5, 1672.3]);
    const world = translation.clone().add(mesh.position);
    expect(mesh.position).toEqual(camPosKm);
    expect(world.x).toBeCloseTo(2745.3, 2);
    expect(world.y).toBeCloseTo(-5986.5, 2);
    expect(world.z).toBeCloseTo(1672.3, 2);
  });

  // Nadir points at Earth's centre, so it must come from the absolute
  // position. Deriving it from the camera-relative one would aim the proxy
  // at the camera instead.
  it('keeps the nadir pose referenced to Earth, not to the camera', () => {
    const near = harness([7000, 0, 0], [7000.1, 0, 0]);
    const far = harness([7000, 0, 0], [0, 0, 42164]);
    const a = new Matrix4();
    const b = new Matrix4();
    near.mesh.getMatrixAt(0, a);
    far.mesh.getMatrixAt(0, b);
    const qa = new Quaternion();
    const qb = new Quaternion();
    a.decompose(new Vector3(), qa, new Vector3()); // decompose, not
    b.decompose(new Vector3(), qb, new Vector3()); // setFromRotationMatrix: the matrix carries scale
    expect(Math.abs(qa.dot(qb))).toBeCloseTo(1, 6);
  });
});
