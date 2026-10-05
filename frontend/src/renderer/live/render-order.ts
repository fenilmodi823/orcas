import type { RenderItem, WebGLRenderer } from 'three';

/*
 * three r185 sorts each render list and then, when the depth buffer is
 * reversed, reverses the WHOLE list (WebGLRenderLists.sort). That fixes the
 * depth order but inverts renderOrder too: StarSky's -1000 ("draw me first")
 * was drawn last and, with no depth test, painted the stars over the Earth.
 *
 * These comparators sort into the opposite of the wanted order, so three's
 * reverse lands on it: renderOrder as written, opaque front to back,
 * transparent back to front. Under reversed depth a larger z is nearer.
 */

/** Wanted opaque order: group, renderOrder, near first. */
function opaqueOrder(a: RenderItem, b: RenderItem): number {
  return a.groupOrder - b.groupOrder || a.renderOrder - b.renderOrder || b.z - a.z || a.id - b.id;
}

/** Wanted transparent order: group, renderOrder, far first. */
function transparentOrder(a: RenderItem, b: RenderItem): number {
  return a.groupOrder - b.groupOrder || a.renderOrder - b.renderOrder || a.z - b.z || a.id - b.id;
}

export const reversedDepthOpaqueSort = (a: RenderItem, b: RenderItem): number => opaqueOrder(b, a);
export const reversedDepthTransparentSort = (a: RenderItem, b: RenderItem): number => transparentOrder(b, a);

/**
 * Make renderOrder mean what it says on a reversed-depth renderer. A no-op
 * where three fell back to the ordinary depth buffer, which it doesn't reverse.
 */
export function keepRenderOrder(gl: WebGLRenderer): void {
  if (!gl.capabilities.reversedDepthBuffer) return;
  gl.setOpaqueSort(reversedDepthOpaqueSort);
  gl.setTransparentSort(reversedDepthTransparentSort);
}
