import type { PerspectiveCamera, Vector3 } from 'three';

/**
 * The camera system sets near from the Earth and its own target (`near-far.ts`).
 * Zoomed out across the Solar System a planet, the Sun or the Moon can be far
 * closer to the camera than that, so pull near in to half the nearest surface,
 * the same rule. Call after the camera system's update, before anything renders.
 * Reversed float depth (P7.D2) keeps the wider near/far ratio precise.
 */
export function clampNearToBodies(
  camera: PerspectiveCamera,
  bodies: readonly { readonly centreKm: Vector3; readonly radiusKm: number }[],
): void {
  let nearestKm = Infinity;
  for (const body of bodies) {
    const surfaceKm = camera.position.distanceTo(body.centreKm) - body.radiusKm;
    if (surfaceKm > 0) nearestKm = Math.min(nearestKm, surfaceKm);
  }
  if (0.5 * nearestKm >= camera.near) return;
  camera.near = 0.5 * nearestKm;
  camera.updateProjectionMatrix();
}
