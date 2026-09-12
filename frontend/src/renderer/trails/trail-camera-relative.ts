/**
 * Subtract the camera's world position from every xyz triple in `positions`,
 * in place — count triples only, the rest of the buffer is untouched.
 *
 * Same technique `tier1-write.ts` uses for instance matrices: three.js keeps
 * `camera.position` in float64 and folds a matching translation into
 * `modelViewMatrix` on the CPU. If the caller also sets its Object3D's own
 * `.position` to that same camera position, the two translations cancel in
 * float64 before anything is downcast to float32 — so only the small,
 * already-camera-relative delta this function produces ever has to survive
 * a float32 buffer. Without it, a trail rendered up close in object-mode
 * (camera within ~metres of a target thousands of km from the origin)
 * shimmers for the same reason Tier 1's instances did before that fix.
 */
export function subtractCameraOffset(
  positions: Float32Array,
  count: number,
  camX: number,
  camY: number,
  camZ: number,
): void {
  for (let i = 0; i < count; i++) {
    positions[i * 3] -= camX;
    positions[i * 3 + 1] -= camY;
    positions[i * 3 + 2] -= camZ;
  }
}
