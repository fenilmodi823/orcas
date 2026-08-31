import { PerspectiveCamera, ShaderMaterial } from 'three';
import type { BufferAttribute, Camera, InterleavedBufferAttribute, Points } from 'three';
import { useCameraTunables } from '../camera/camera-tunables.js';

/**
 * The whole of Tier 0's per-frame GPU-side work in one place: re-flag the
 * buffers M1.2 already wrote so they re-upload, then refresh the uniforms
 * that depend on the camera or on the dev panel.
 *
 * Zero-allocation by construction — every write lands in an existing
 * buffer or an existing uniform object. Returns the material so the
 * caller can keep writing the uniforms that need its own local state.
 */
export function writePerFrameUniforms(
  points: Points,
  positionAttribute: BufferAttribute | InterleavedBufferAttribute,
  camera: Camera,
  viewportHeightPx: number,
): ShaderMaterial {
  positionAttribute.needsUpdate = true;

  const staleAttribute = points.geometry.getAttribute('aStale');
  if (staleAttribute) staleAttribute.needsUpdate = true;

  const material = points.material as ShaderMaterial;
  if (camera instanceof PerspectiveCamera) {
    const verticalFovRad = (camera.fov * Math.PI) / 180;
    material.uniforms.uPixelsPerRadian.value = viewportHeightPx / verticalFovRad;
  }
  material.uniforms.uCamPos.value.copy(camera.position);

  // The LOD band is a dev-panel tunable (M1.7a Task 11). Tier 1 reads the
  // same two values from the same store in the same frame, so the two
  // alphas keep summing to one at whatever band the reviewer dials in.
  const band = useCameraTunables.getState();
  material.uniforms.uLodLoPx.value = band.lodLoPx;
  material.uniforms.uLodHiPx.value = band.lodHiPx;

  return material;
}
