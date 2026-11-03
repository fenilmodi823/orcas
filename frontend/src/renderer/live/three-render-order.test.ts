import { describe, expect, it } from 'vitest';
import { MeshBasicMaterial, Object3D, type BufferGeometry, type Camera, type Material } from 'three';
import { WebGLRenderList } from 'three/src/renderers/webgl/WebGLRenderLists.js';

/*
 * StarSky draws first (renderOrder -1000) with no depth test, so anything
 * that sorts after it is painted over. three r185/r186 reversed the whole
 * render list under a reversed depth buffer and ORCAS re-inverted it; r187
 * negates z instead, and the old workaround then drew the stars last, over
 * every planet and moon. These run three's own list, so an upgrade that
 * changes its sort again fails here, not on screen.
 */

/** The list as r187 drives it (its push takes the camera; @types/three 0.187 omits it). */
interface RenderList {
  init(): void;
  push(object: Object3D, geometry: BufferGeometry | null, material: Material, groupOrder: number, z: number, group: null, camera: Camera): void;
  finish(): void;
  sort(): void;
  opaque: { object: Object3D }[];
  transparent: { object: Object3D }[];
}

// push reads only this; on a real camera it is a getter the renderer sets.
const camera = { reversedDepth: true } as unknown as Camera;

function drawOrder(items: { name: string; renderOrder: number; z: number; material: Material }[], pick: 'opaque' | 'transparent'): string[] {
  const list = new WebGLRenderList(undefined as never) as unknown as RenderList;
  list.init();
  for (const { name, renderOrder, z, material } of items) {
    const object = Object.assign(new Object3D(), { name, renderOrder });
    list.push(object, null, material, 0, z, null, camera);
  }
  list.finish();
  list.sort();
  return list[pick].map((item) => item.object.name);
}

describe("three's render order under a reversed depth buffer", () => {
  // Projected z under reversed depth: nearer is larger.
  it('draws the star sky (renderOrder -1000) before the planets and moons', () => {
    const solid = new MeshBasicMaterial();
    const order = drawOrder(
      [
        { name: 'moon', renderOrder: 0, z: 0.9, material: solid },
        { name: 'stars', renderOrder: -1000, z: 0.1, material: new MeshBasicMaterial() },
        { name: 'jupiter', renderOrder: 0, z: 0.2, material: solid },
      ],
      'opaque',
    );
    expect(order[0]).toBe('stars');
  });

  it('keeps opaque objects front to back within one renderOrder', () => {
    const solid = new MeshBasicMaterial();
    const order = drawOrder(
      [
        { name: 'far', renderOrder: 0, z: 0.1, material: solid },
        { name: 'near', renderOrder: 0, z: 0.9, material: solid },
      ],
      'opaque',
    );
    expect(order).toEqual(['near', 'far']);
  });

  it('draws the heatmap overlay (renderOrder 1000) last, and transparent objects back to front', () => {
    const glass = new MeshBasicMaterial({ transparent: true });
    const order = drawOrder(
      [
        { name: 'overlay', renderOrder: 1000, z: 0.9, material: glass },
        { name: 'near', renderOrder: 0, z: 0.9, material: glass },
        { name: 'far', renderOrder: 0, z: 0.1, material: glass },
      ],
      'transparent',
    );
    expect(order).toEqual(['far', 'near', 'overlay']);
  });
});
