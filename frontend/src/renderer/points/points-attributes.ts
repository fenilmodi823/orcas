import type { ObjectMeta } from '../../data/catalog-types.js';

/**
 * No per-object physical size exists in the ingested data: `OmmRecord`
 * (packages/orcas-physics/src/types.ts) carries no RCS_SIZE field at all —
 * verified by reading the CelesTrak OMM schema this codebase actually
 * ingests, not assumed. Rather than invent a per-object size (Rules.md
 * §7, "never invent numbers"), every point uses this one placeholder —
 * 10 metres, a plausible order of magnitude for a small satellite, not a
 * measurement. Real RCS ingestion is a Data-Strategy follow-up.
 */
export const PLACEHOLDER_RADIUS_KM = 0.01;

/** aFlags sentinel: bit 0 set means "visible." M1.4 adds more bits later
 * without renaming this attribute. */
export const FLAG_VISIBLE = 1.0;

/**
 * `aEntityId`: each point's own index into the `objects`/`FrameState`
 * arrays (0..count-1) — the same index every other per-object buffer
 * already uses (see frame-state.ts's `evaluateFrame`). Using the array
 * index rather than the NORAD number also sidesteps the brief's own
 * float32-precision caveat on this attribute, since indices stay far
 * below 2^24 long before catalog numbers would.
 */
export function packEntityIds(count: number): Float32Array {
  const ids = new Float32Array(count);
  for (let i = 0; i < count; i++) ids[i] = i;
  return ids;
}

/** `aRegime`: the object's already-classified Regime enum value, copied
 * verbatim — LEO=0, MEO=1, GEO=2, HEO=3, Unknown=4. */
export function packRegimes(objects: readonly ObjectMeta[]): Float32Array {
  const regimes = new Float32Array(objects.length);
  for (let i = 0; i < objects.length; i++) regimes[i] = objects[i].regime;
  return regimes;
}

/** `aRadius`, km. See `PLACEHOLDER_RADIUS_KM`'s docstring for why every
 * entry is currently the same value. */
export function packRadii(count: number): Float32Array {
  return new Float32Array(count).fill(PLACEHOLDER_RADIUS_KM);
}
