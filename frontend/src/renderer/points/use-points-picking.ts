import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { WebGLRenderTarget, type Points } from 'three';
import { useThree } from '@react-three/fiber';
import { PICK_LAYER } from './points-shader-core.js';
import { createPickMaterial } from './points-pick-material.js';
import { shouldIssuePick } from './points-pick-schedule.js';
import { findBestPixel } from './points-pick-resolve.js';
import { unpackIdBytes } from './points-pick-id.js';

const WINDOW_SIZE = 5; // brief §D.2

interface PendingRead {
  fence: WebGLSync;
}

export interface PointsPickingHandle {
  /** Enqueue a pick at these canvas-pixel coordinates (same coordinate
   * space as `size.width`/`size.height` from useThree() — CSS pixels
   * relative to the canvas, matching getBoundingClientRect()). Coalesced
   * per this plan's cadence rules — calling this every pointermove is
   * safe. */
  requestPick(px: number, py: number): void;
  /** Call once per frame (from useFrame). Advances the pick pipeline by
   * at most one step: starts a render if one was requested and none is
   * in flight, or polls a fence that's already in flight. Returns a
   * decoded hit only on the frame it actually resolves, else null. */
  pollPick(): { entityIndex: number; tierTag: number } | null;
}

/**
 * The pick pass (brief §D.2). Never a synchronous `readPixels`: every
 * readback goes through one reused pixel-pack buffer plus a fence,
 * polled non-blockingly across frames. `camera.setViewOffset` restricts
 * the render to a 5x5 window — "25 fragments, not W×H" — rendered into a
 * dedicated tiny WebGLRenderTarget (never the screen), and
 * `clearViewOffset()`/layer restoration run in a `finally` so they
 * happen even if the render itself throws.
 *
 * `renderer.properties.get(target).__webglFramebuffer` reaches into a
 * semi-internal three.js API — there is no public API for binding a
 * render target's framebuffer for a raw `gl.readPixels` call, and this
 * is the established technique the community uses for exactly this case
 * (see the brief's own "InstancedMesh picking in 2024" reference). If a
 * future `three` upgrade changes this shape, it breaks loudly (a
 * `getContext()`/`readPixels` error), not silently.
 */
export function usePointsPicking(pointsRef: MutableRefObject<Points | null>): PointsPickingHandle {
  const { gl, camera, scene, size } = useThree();
  const pickMaterialRef = useRef(createPickMaterial());
  const renderTargetRef = useRef<WebGLRenderTarget | null>(null);
  const pboRef = useRef<WebGLBuffer | null>(null);
  const pendingRef = useRef<PendingRead | null>(null);
  const requestedRef = useRef<{ px: number; py: number } | null>(null);
  const lastRequestedRef = useRef<{ px: number; py: number } | null>(null);

  useEffect(() => {
    const context = gl.getContext() as WebGL2RenderingContext;
    const pbo = context.createBuffer();
    context.bindBuffer(context.PIXEL_PACK_BUFFER, pbo);
    context.bufferData(context.PIXEL_PACK_BUFFER, WINDOW_SIZE * WINDOW_SIZE * 4, context.STREAM_READ);
    context.bindBuffer(context.PIXEL_PACK_BUFFER, null);
    pboRef.current = pbo;

    const renderTarget = new WebGLRenderTarget(WINDOW_SIZE, WINDOW_SIZE);
    renderTargetRef.current = renderTarget;

    const material = pickMaterialRef.current;
    return () => {
      context.deleteBuffer(pbo);
      renderTarget.dispose();
      material.dispose();
    };
  }, [gl]);

  function requestPick(px: number, py: number): void {
    if (
      !shouldIssuePick({
        px,
        py,
        lastRequested: lastRequestedRef.current,
        inFlight: pendingRef.current !== null,
        suppressed: false,
      })
    ) {
      return;
    }
    requestedRef.current = { px, py };
  }

  function startPickRender(px: number, py: number): void {
    const points = pointsRef.current;
    const pbo = pboRef.current;
    const renderTarget = renderTargetRef.current;
    if (!points || !pbo || !renderTarget) return;

    const context = gl.getContext() as WebGL2RenderingContext;
    const previousMaterial = points.material;
    const previousCameraLayerMask = camera.layers.mask;
    const previousRenderTarget = gl.getRenderTarget();

    try {
      camera.layers.set(PICK_LAYER);
      camera.setViewOffset(size.width, size.height, px - 2, py - 2, WINDOW_SIZE, WINDOW_SIZE);
      points.material = pickMaterialRef.current;

      gl.setRenderTarget(renderTarget);
      gl.render(scene, camera);

      const framebuffer = (
        gl.properties.get(renderTarget) as { __webglFramebuffer: WebGLFramebuffer }
      ).__webglFramebuffer;
      context.bindFramebuffer(context.FRAMEBUFFER, framebuffer);
      context.bindBuffer(context.PIXEL_PACK_BUFFER, pbo);
      context.readPixels(0, 0, WINDOW_SIZE, WINDOW_SIZE, context.RGBA, context.UNSIGNED_BYTE, 0);
      context.bindBuffer(context.PIXEL_PACK_BUFFER, null);
      const fence = context.fenceSync(context.SYNC_GPU_COMMANDS_COMPLETE, 0);
      context.flush();
      if (fence) pendingRef.current = { fence };
    } finally {
      gl.setRenderTarget(previousRenderTarget);
      camera.clearViewOffset();
      camera.layers.mask = previousCameraLayerMask;
      points.material = previousMaterial;
    }

    lastRequestedRef.current = { px, py };
    requestedRef.current = null;
  }

  function pollPick(): { entityIndex: number; tierTag: number } | null {
    const pending = pendingRef.current;
    const pbo = pboRef.current;
    if (pending && pbo) {
      const context = gl.getContext() as WebGL2RenderingContext;
      const status = context.clientWaitSync(pending.fence, 0, 0);
      if (status === context.CONDITION_SATISFIED || status === context.ALREADY_SIGNALED) {
        const pixels = new Uint8Array(WINDOW_SIZE * WINDOW_SIZE * 4);
        context.bindBuffer(context.PIXEL_PACK_BUFFER, pbo);
        context.getBufferSubData(context.PIXEL_PACK_BUFFER, 0, pixels);
        context.bindBuffer(context.PIXEL_PACK_BUFFER, null);
        context.deleteSync(pending.fence);
        pendingRef.current = null;

        const bestOffset = findBestPixel(pixels, WINDOW_SIZE);
        return bestOffset === null ? null : unpackIdBytes(pixels, bestOffset);
      }
      return null; // not signaled yet — check again next frame, per brief §D.2
    }

    const requested = requestedRef.current;
    if (requested) startPickRender(requested.px, requested.py);
    return null;
  }

  return { requestPick, pollPick };
}
