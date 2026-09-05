import { Color, Matrix4, Quaternion, Vector3 } from 'three';
import type { InstancedMesh } from 'three';
import type { FrameState } from '../../simulation/frame-state.js';
import { PLACEHOLDER_RADIUS_KM } from '../object-extents.js';
import { apparentPx } from '../points/points-shading.js';
import { LOD_BAND_PX, tier1Alpha, type LodBand } from '../lod/lod-band.js';
import { lvlhQuaternion } from './lvlh-pose.js';

/** The proxy is drawn at the same assumed extent the LOD band thresholds
 * on, so the mesh you see is the size the promotion maths claimed. */
export const TIER1_PROXY_SCALE_KM = PLACEHOLDER_RADIUS_KM;

/**
 * Tier 1's share of the intensity, the exact complement of the Tier 0
 * shader's `1.0 - smoothstep(uLodLoPx, uLodHiPx, truePx)`. Both come from
 * lod-band.ts, so they sum to 1 by construction (brief §B.6).
 *
 * Intensity, not opacity: Tier 0 fades by scaling `brightness`, and §B.6's
 * guarantee is about the SUM OF INTENSITY against a black sky.
 */
export function instanceBrightness(
  distanceKm: number,
  pixelsPerRadian: number,
  radiusKm: number,
  band: LodBand = LOD_BAND_PX,
): number {
  return tier1Alpha(apparentPx(radiusKm, distanceKm, pixelsPerRadian), band);
}

const _pos = new Vector3();
const _quat = new Quaternion();
const _scale = new Vector3();
const _matrix = new Matrix4();
const _color = new Color();

/** P4.D27, matching TierZeroPoints.tsx's `uDimFactor` — a readable floor,
 * not a blackout, for every non-selected instance while a selection is
 * active. */
export const TIER1_DIM_FACTOR = 0.45;

export interface Tier1WriteArgs {
  readonly mesh: InstancedMesh;
  readonly frame: FrameState;
  readonly members: Uint32Array;
  readonly memberCount: number;
  readonly camPosKm: Vector3;
  readonly pixelsPerRadian: number;
  readonly tint: Color;
  readonly band: LodBand;
  /** Catalogue index of the current selection, or omitted/-1 for none.
   * Tier 1 has no shader uniform the way Tier 0 does (`uDimFactor` /
   * `uFocusActive`), so the same P4.D27 dim floor is applied here in
   * plain per-instance colour arithmetic instead. */
  readonly selectedIndex?: number;
}

/**
 * Write one frame of instance matrices and per-instance brightness.
 * Returns the number of instances written, which the caller assigns to
 * `mesh.count` so the GPU draws only the live members.
 *
 * ⭐ CAMERA-RELATIVE ORIGIN (brief §C.2, scoped to this tier). Instance
 * matrices live in a Float32Array and `modelViewMatrix * instanceMatrix`
 * is evaluated on the GPU in float32. A world-space translation of
 * ~7,000 km quantises to ~0.4 m there, and the view-matrix product then
 * cancels two ~7,000 km terms down to ~0.08 km — catastrophic
 * cancellation. At the ~82 m the fly-to arrives at, one pixel is ~0.07 m,
 * so that error is roughly SIX PIXELS of shimmer, re-rounded every frame
 * as the camera moves. It is what the M1.7a review saw as the octahedron
 * "shaking rapidly" on approach.
 *
 * The fix is the standard one and it is cheap here: carry the big number
 * on the mesh's own transform, which three.js keeps in float64 and folds
 * into `modelViewMatrix` on the CPU, and write only the small camera-
 * relative offsets into float32. Every float32 value is then ~0.1 km,
 * where the quantum is ~6 nm.
 *
 * This does NOT make the tier floating-origin correct in general — Tier 0
 * still uploads absolute positions, and the full re-origin is M1.9's job.
 * It fixes the one place where the error is visible, because it is the
 * only place the camera gets within metres of the geometry.
 *
 * Allocation-free: every temporary is module-scope and reused forever.
 */
export function writeTier1Instances(args: Tier1WriteArgs): number {
  const { mesh, frame, members, memberCount, camPosKm, pixelsPerRadian, tint, band } = args;
  const selectedIndex = args.selectedIndex ?? -1;
  mesh.position.copy(camPosKm);
  for (let slot = 0; slot < memberCount; slot++) {
    const i = members[slot];
    _pos.set(frame.positions[i * 3], frame.positions[i * 3 + 1], frame.positions[i * 3 + 2]);
    // Nadir is a direction from Earth's centre, so the pose is derived from
    // the ABSOLUTE position — before the camera offset is taken out.
    lvlhQuaternion(_pos, _quat);
    _pos.sub(camPosKm);
    _scale.setScalar(TIER1_PROXY_SCALE_KM);
    _matrix.compose(_pos, _quat, _scale);
    mesh.setMatrixAt(slot, _matrix);

    // _pos is now the camera->object vector, so its length IS the distance.
    const brightness = instanceBrightness(_pos.length(), pixelsPerRadian, PLACEHOLDER_RADIUS_KM, band);
    const dim = selectedIndex === -1 || i === selectedIndex ? 1 : TIER1_DIM_FACTOR;
    _color.copy(tint).multiplyScalar(brightness * dim);
    mesh.setColorAt(slot, _color);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return memberCount;
}
