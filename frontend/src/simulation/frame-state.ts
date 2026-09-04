import type { ObjectMeta } from '../data/catalog-types.js';
import type { KeyframeRing } from './keyframe-ring.js';
import { sampleSegment } from '../propagation/segment-builder.js';
import { Flag } from './flags.js';

export { Flag };

/**
 * Hot, read-every-frame state — brief §A.3 "Structure-of-arrays for hot
 * data." Readonly at the type level for every consumer; `evaluateFrame`
 * mutates the SAME underlying buffers in place every call — they are
 * never reallocated (see frame-state.test.ts's zero-allocation check).
 */
export interface FrameState {
  readonly epochMs: number;
  readonly count: number;
  readonly generation: number;
  readonly positions: Float32Array; // 3N, km, J2000 (segment-builder.ts's frame)
  readonly velocities: Float32Array; // 3N, km/s, J2000
  readonly flags: Uint8Array; // N
}

/** Internal mutable view of the same object — never exported. The public
 * `FrameState` type is readonly so nothing outside this module can
 * reassign a field; this module is the one place allowed to mutate it,
 * in place, forever. */
interface MutableFrameState {
  epochMs: number;
  count: number;
  generation: number;
  readonly positions: Float32Array;
  readonly velocities: Float32Array;
  readonly flags: Uint8Array;
}

/** Allocate a FrameState's buffers once, for `count` objects. Called
 * exactly once per debug-route mount — every subsequent frame reuses
 * these same arrays via evaluateFrame. */
export function createFrameState(count: number): FrameState {
  const state: MutableFrameState = {
    epochMs: 0,
    count,
    generation: -1,
    positions: new Float32Array(3 * count),
    velocities: new Float32Array(3 * count),
    flags: new Uint8Array(count),
  };
  return state;
}

/**
 * Evaluate every object's position/velocity at `epochMs` and write the
 * result into `frameState`'s existing buffers — zero allocation. An
 * object with no segment covering the ring's current window is flagged
 * `Stale` and left at its last-written value; it is never written with
 * `NaN`.
 */
export function evaluateFrame(
  frameState: FrameState,
  ring: KeyframeRing,
  objects: readonly ObjectMeta[],
  epochMs: number,
): FrameState {
  const mutable = frameState as unknown as MutableFrameState;
  mutable.epochMs = epochMs;
  mutable.generation = ring.generation;

  for (let i = 0; i < objects.length; i++) {
    const segment = ring.segments.get(objects[i].norad);
    // M1.7b D-C: the brief's definition is "no segment covers this
    // epoch", not just "no segment in the ring" — an object whose
    // segment window has passed (the ring rebuild is in flight) is
    // extrapolated by sampleSegment's clamp and would otherwise report
    // Flag.None, which is wrong for a consumer that needs to know the
    // position is not currently trustworthy (M1.7b's trails: appending
    // a clamp-frozen point during a rebuild gap would poison the trail
    // with a point the object never actually occupied at that instant).
    if (!segment || epochMs < segment.t0Ms || epochMs > segment.t1Ms) {
      mutable.flags[i] = Flag.Stale;
      continue; // leave the position at its last-written value, never NaN
    }
    const state = sampleSegment(segment, epochMs);
    mutable.positions[i * 3] = state.position.x;
    mutable.positions[i * 3 + 1] = state.position.y;
    mutable.positions[i * 3 + 2] = state.position.z;
    mutable.velocities[i * 3] = state.velocity.x;
    mutable.velocities[i * 3 + 1] = state.velocity.y;
    mutable.velocities[i * 3 + 2] = state.velocity.z;
    mutable.flags[i] = Flag.None;
  }
  return frameState;
}
