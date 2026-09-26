import { describe, expect, it } from 'vitest';
import { Color, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { TIER1_DIM_FACTOR, writeTier1Instances } from './tier1-write.js';
import { createSatelliteProxyGeometry } from './satellite-proxy.js';
import { LOD_BAND_PX } from '../lod/lod-band.js';
import { ObjType, OrbitClass, type ObjectMeta } from '../../data/catalog-types.js';

const PX_PER_RAD = 1188;

/** White for every orbit class and the selection accent — preserves this
 * file's pre-P4.D23 assertions, which read `.r` as a direct stand-in for
 * brightness/dim, unaffected by which orbit class a fake object carries. */
const WHITE_ORBIT_CLASS_COLORS: readonly Color[] = [1, 1, 1, 1, 1].map(() => new Color(1, 1, 1));
const WHITE_SELECTED_COLOR = new Color(1, 1, 1);

function fakeObjects(count: number): ObjectMeta[] {
  return Array.from({ length: count }, (_, i) => ({
    norad: String(i) as ObjectMeta['norad'],
    name: String(i),
    objectId: String(i),
    type: ObjType.Payload,
    orbitClass: OrbitClass.LEO,
    isActive: true,
    sourceType: 'live',
    source: 'celestrak',
    epochMs: 0,
    record: {} as ObjectMeta['record'],
  }));
}

describe('writeTier1Instances — camera-relative origin', () => {
  function harness(objectKm: [number, number, number], camKm: [number, number, number]) {
    const mesh = new InstancedMesh(createSatelliteProxyGeometry(), new MeshStandardMaterial(), 4);
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
      objects: fakeObjects(1),
      orbitClassColors: WHITE_ORBIT_CLASS_COLORS,
      selectedColor: WHITE_SELECTED_COLOR,
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

describe('writeTier1Instances — P4.D27 focus dim', () => {
  function frameOf(positions: number[]): Parameters<typeof writeTier1Instances>[0]['frame'] {
    return {
      positions: new Float32Array(positions),
      velocities: new Float32Array(positions.length).fill(0),
      epochMs: 0,
      count: positions.length / 3,
      generation: 0,
      flags: new Uint8Array(positions.length / 3),
    } as unknown as Parameters<typeof writeTier1Instances>[0]['frame'];
  }

  // Close enough that instanceBrightness saturates to 1 for both members —
  // isolates the dim factor from the distance-based brightness curve.
  const CLOSE_CAM: [number, number, number] = [7000.01, 0, 0];

  it('dims every non-selected instance to TIER1_DIM_FACTOR while a selection is active', () => {
    const mesh = new InstancedMesh(createSatelliteProxyGeometry(), new MeshStandardMaterial(), 4);
    writeTier1Instances({
      mesh,
      frame: frameOf([7000, 0, 0, 7000, 0, 0.01]),
      members: new Uint32Array([0, 1]),
      memberCount: 2,
      camPosKm: new Vector3(...CLOSE_CAM),
      pixelsPerRadian: PX_PER_RAD,
      objects: fakeObjects(2),
      orbitClassColors: WHITE_ORBIT_CLASS_COLORS,
      selectedColor: WHITE_SELECTED_COLOR,
      band: LOD_BAND_PX,
      selectedIndex: 0,
    });
    const selected = new Color();
    const other = new Color();
    mesh.getColorAt(0, selected);
    mesh.getColorAt(1, other);
    expect(selected.r).toBeCloseTo(1, 3);
    expect(other.r).toBeCloseTo(TIER1_DIM_FACTOR, 3);
  });

  it('dims nothing when no selection is active', () => {
    const mesh = new InstancedMesh(createSatelliteProxyGeometry(), new MeshStandardMaterial(), 4);
    writeTier1Instances({
      mesh,
      frame: frameOf([7000, 0, 0, 7000, 0, 0.01]),
      members: new Uint32Array([0, 1]),
      memberCount: 2,
      camPosKm: new Vector3(...CLOSE_CAM),
      pixelsPerRadian: PX_PER_RAD,
      objects: fakeObjects(2),
      orbitClassColors: WHITE_ORBIT_CLASS_COLORS,
      selectedColor: WHITE_SELECTED_COLOR,
      band: LOD_BAND_PX,
      // selectedIndex omitted — pre-M1.7b callers keep their old behaviour.
    });
    const a = new Color();
    const b = new Color();
    mesh.getColorAt(0, a);
    mesh.getColorAt(1, b);
    expect(a.r).toBeCloseTo(1, 3);
    expect(b.r).toBeCloseTo(1, 3);
  });
});

describe('writeTier1Instances — P4.D23/24 orbit-class colour', () => {
  const CLOSE_CAM: [number, number, number] = [7000.01, 0, 0];
  const ORBIT_CLASS_COLORS: readonly Color[] = [
    new Color(1, 0, 0), // LEO
    new Color(0, 1, 0), // MEO
    new Color(0, 0, 1), // GEO
    new Color(1, 1, 0), // HEO
    new Color(1, 0, 1), // Unknown
  ];
  const SELECTED_COLOR = new Color(0, 1, 1);

  function frameOf(positions: number[]): Parameters<typeof writeTier1Instances>[0]['frame'] {
    return {
      positions: new Float32Array(positions),
      velocities: new Float32Array(positions.length).fill(0),
      epochMs: 0,
      count: positions.length / 3,
      generation: 0,
      flags: new Uint8Array(positions.length / 3),
    } as unknown as Parameters<typeof writeTier1Instances>[0]['frame'];
  }

  it("a non-selected instance is coloured by its own object's orbit class", () => {
    const mesh = new InstancedMesh(createSatelliteProxyGeometry(), new MeshStandardMaterial(), 4);
    const objects = fakeObjects(2);
    objects[1] = { ...objects[1], orbitClass: OrbitClass.MEO };
    writeTier1Instances({
      mesh,
      frame: frameOf([7000, 0, 0, 7000, 0, 0.01]),
      members: new Uint32Array([0, 1]),
      memberCount: 2,
      camPosKm: new Vector3(...CLOSE_CAM),
      pixelsPerRadian: PX_PER_RAD,
      objects,
      orbitClassColors: ORBIT_CLASS_COLORS,
      selectedColor: SELECTED_COLOR,
      band: LOD_BAND_PX,
    });
    const leo = new Color();
    const meo = new Color();
    mesh.getColorAt(0, leo);
    mesh.getColorAt(1, meo);
    expect(leo.g).toBeCloseTo(0, 3); // LEO is red, not green
    expect(meo.g).toBeCloseTo(1, 3); // MEO is green
  });

  it('a selected instance is coloured by the selection accent, not its orbit class', () => {
    const mesh = new InstancedMesh(createSatelliteProxyGeometry(), new MeshStandardMaterial(), 4);
    writeTier1Instances({
      mesh,
      frame: frameOf([7000, 0, 0]),
      members: new Uint32Array([0]),
      memberCount: 1,
      camPosKm: new Vector3(...CLOSE_CAM),
      pixelsPerRadian: PX_PER_RAD,
      objects: fakeObjects(1),
      orbitClassColors: ORBIT_CLASS_COLORS,
      selectedColor: SELECTED_COLOR,
      band: LOD_BAND_PX,
      selectedIndex: 0,
    });
    const color = new Color();
    mesh.getColorAt(0, color);
    expect(color.r).toBeCloseTo(0, 3); // not LEO's red
    expect(color.g).toBeCloseTo(1, 3); // the selection accent's cyan
    expect(color.b).toBeCloseTo(1, 3);
  });
});
