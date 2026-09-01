import type { Camera, Vector3 } from 'three';
import type { ObjectTetherHandle } from '../../ui/ObjectTether.js';

/**
 * Project one object's LIVE position to screen space and write it straight
 * to the DOM (brief §D.6). Imperative on purpose: this runs every frame,
 * and Rules.md bans React state on that path.
 *
 * Extracted so hover and selection can share one implementation — the brief
 * allows exactly two tethers, one each, and two copies of a projection is
 * how they drift apart.
 *
 * `scratch` is caller-owned, so this allocates nothing. Returns whether the
 * tether ended up visible.
 */
export function writeTetherPosition(
  tether: ObjectTetherHandle | null,
  index: number,
  positions: Float32Array,
  camera: Camera,
  widthPx: number,
  heightPx: number,
  scratch: Vector3,
): boolean {
  if (!tether) return false;
  if (index < 0) {
    tether.setVisible(false);
    return false;
  }

  scratch.set(positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2]).project(camera);
  // z > 1 is behind the camera — the same test CameraSystem.projectToScreen
  // makes. Without it a target behind you is drawn mirrored across the
  // screen, which reads as a second object.
  if (scratch.z > 1) {
    tether.setVisible(false);
    return false;
  }

  tether.setPosition((scratch.x * 0.5 + 0.5) * widthPx, (1 - (scratch.y * 0.5 + 0.5)) * heightPx);
  tether.setVisible(true);
  return true;
}

/**
 * Drive both tethers from one projection (brief §D.6 allows exactly two:
 * one for `selected`, one for `hover`).
 *
 * When both resolve to the SAME object the HOVER chip is suppressed and the
 * selected one kept — never the other way round. Hover comes from an async
 * GPU readback that resolves on roughly one frame in N, so suppressing the
 * selected chip on hover made the name blink on and off wherever the cursor
 * sat over its own satellite, which is most of the screen once you are
 * zoomed in on it. The persistent label has to be the stable one.
 */
export function writeTethers(args: {
  readonly hoverTether: ObjectTetherHandle | null;
  readonly selectedTether: ObjectTetherHandle | null;
  readonly hoverIndex: number;
  readonly selectedIndex: number;
  readonly positions: Float32Array;
  readonly camera: Camera;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly scratch: Vector3;
}): void {
  const { hoverTether, selectedTether, hoverIndex, selectedIndex } = args;
  const { positions, camera, widthPx, heightPx, scratch } = args;
  const hoverVisibleIndex = hoverIndex === selectedIndex ? -1 : hoverIndex;
  writeTetherPosition(hoverTether, hoverVisibleIndex, positions, camera, widthPx, heightPx, scratch);
  writeTetherPosition(selectedTether, selectedIndex, positions, camera, widthPx, heightPx, scratch);
}
