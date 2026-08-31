import { Color, Matrix4, Quaternion, Vector3 } from 'three';
import type { InstancedMesh } from 'three';
import type { FrameState } from '../../simulation/frame-state.js';
import { PLACEHOLDER_RADIUS_KM } from '../object-extents.js';
import { apparentPx } from '../points/points-shading.js';
import { tier1Alpha } from '../lod/lod-band.js';
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
): number {
  return tier1Alpha(apparentPx(radiusKm, distanceKm, pixelsPerRadian));
}

const _pos = new Vector3();
const _quat = new Quaternion();
const _scale = new Vector3();
const _matrix = new Matrix4();
const _color = new Color();

export interface Tier1WriteArgs {
  readonly mesh: InstancedMesh;
  readonly frame: FrameState;
  readonly members: Uint32Array;
  readonly memberCount: number;
  readonly camPosKm: Vector3;
  readonly pixelsPerRadian: number;
  readonly tint: Color;
}

/**
 * Write one frame of instance matrices and per-instance brightness.
 * Returns the number of instances written, which the caller assigns to
 * `mesh.count` so the GPU draws only the live members.
 *
 * Allocation-free: every temporary is module-scope and reused forever.
 */
export function writeTier1Instances(args: Tier1WriteArgs): number {
  const { mesh, frame, members, memberCount, camPosKm, pixelsPerRadian, tint } = args;
  for (let slot = 0; slot < memberCount; slot++) {
    const i = members[slot];
    _pos.set(frame.positions[i * 3], frame.positions[i * 3 + 1], frame.positions[i * 3 + 2]);
    lvlhQuaternion(_pos, _quat);
    _scale.setScalar(TIER1_PROXY_SCALE_KM);
    _matrix.compose(_pos, _quat, _scale);
    mesh.setMatrixAt(slot, _matrix);

    const brightness = instanceBrightness(
      _pos.distanceTo(camPosKm),
      pixelsPerRadian,
      PLACEHOLDER_RADIUS_KM,
    );
    _color.copy(tint).multiplyScalar(brightness);
    mesh.setColorAt(slot, _color);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return memberCount;
}
