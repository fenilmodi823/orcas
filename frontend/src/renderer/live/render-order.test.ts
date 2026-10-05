import { describe, expect, it } from 'vitest';
import type { RenderItem } from 'three';
import { reversedDepthOpaqueSort, reversedDepthTransparentSort } from './render-order.js';

// Under a reversed depth buffer a larger z is NEARER the camera.
function item(name: string, renderOrder: number, z: number, groupOrder = 0): RenderItem {
  return { id: name.length, object: { name }, renderOrder, z, groupOrder } as unknown as RenderItem;
}

/** What three r185 does with a custom sort under reversed depth: sort, then reverse the whole list. */
function threeOrder(items: RenderItem[], sort: (a: RenderItem, b: RenderItem) => number): string[] {
  return [...items].sort(sort).reverse().map((i) => i.object.name);
}

describe('render order under a reversed depth buffer', () => {
  it('draws the star sky (renderOrder -1000) before the Earth, as renderOrder says', () => {
    const order = threeOrder([item('earth', 0, 5), item('stars', -1000, 5)], reversedDepthOpaqueSort);
    expect(order).toEqual(['stars', 'earth']);
  });

  it('keeps opaque objects front to back within one renderOrder', () => {
    const order = threeOrder([item('far', 0, 1), item('near', 0, 9)], reversedDepthOpaqueSort);
    expect(order).toEqual(['near', 'far']);
  });

  it('draws the heatmap overlay (renderOrder 1000) after every other transparent object', () => {
    const order = threeOrder([item('overlay', 1000, 1), item('atmosphere', 1, 5), item('path', 0, 9)], reversedDepthTransparentSort);
    expect(order).toEqual(['path', 'atmosphere', 'overlay']);
  });

  it('keeps transparent objects back to front within one renderOrder', () => {
    const order = threeOrder([item('near', 0, 9), item('far', 0, 1)], reversedDepthTransparentSort);
    expect(order).toEqual(['far', 'near']);
  });

  it('puts group order before render order, as three does', () => {
    const order = threeOrder([item('grouped', -5, 5, 1), item('loose', 0, 5, 0)], reversedDepthOpaqueSort);
    expect(order).toEqual(['loose', 'grouped']);
  });
});
