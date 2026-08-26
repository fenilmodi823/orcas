import { BufferAttribute, BufferGeometry } from 'three';
import type { ObjectMeta } from '../../data/catalog-types.js';
import type { OrbitClass } from '../../state/selection-store.js';
import { packEntityIds, packRegimes, packRadii } from './points-attributes.js';
import { packFilterFlags } from './points-filters.js';

/**
 * Builds the Tier 0 `THREE.BufferGeometry` (brief §B.3). `positions` and
 * `staleFlags` are both wrapped **by reference** — the caller
 * (TierZeroPoints.tsx) mutates the same M1.2 `FrameState` buffers in
 * place every frame and flips `needsUpdate`, so this function must never
 * copy either (a copy would be exactly the per-frame allocation the
 * milestone's DoD forbids). `aFlags` is built fresh from the real
 * classifier and the filter set active at call time — see
 * `updateFlagsAttribute` for rewriting it later without rebuilding the
 * whole geometry.
 */
export function createPointsGeometry(
  objects: readonly ObjectMeta[],
  positions: Float32Array,
  staleFlags: Uint8Array,
  activeFilters: ReadonlySet<OrbitClass>,
): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aEntityId', new BufferAttribute(packEntityIds(objects.length), 1));
  geometry.setAttribute('aRegime', new BufferAttribute(packRegimes(objects), 1));
  geometry.setAttribute('aRadius', new BufferAttribute(packRadii(objects.length), 1));
  geometry.setAttribute('aFlags', new BufferAttribute(packFilterFlags(objects, activeFilters), 1));
  // Plain BufferAttribute, not Uint8BufferAttribute — that subclass's
  // constructor does `new Uint8Array(array)`, which copies even when
  // `array` is already a Uint8Array (per the TypedArray constructor
  // spec), silently breaking the zero-copy contract every other
  // attribute here relies on. BufferAttribute wraps the array directly.
  geometry.setAttribute('aStale', new BufferAttribute(staleFlags, 1));
  return geometry;
}

/**
 * Rewrites `aFlags`'s contents in place and flags it for GPU re-upload —
 * called ONLY when the active filter set changes (brief: "Filter
 * re-evaluation: on filter change only, never per frame"). Every other
 * attribute's underlying array is untouched, so this costs exactly one
 * attribute upload, never a geometry rebuild.
 */
export function updateFlagsAttribute(
  geometry: BufferGeometry,
  objects: readonly ObjectMeta[],
  activeFilters: ReadonlySet<OrbitClass>,
): void {
  const attribute = geometry.getAttribute('aFlags') as BufferAttribute;
  const flags = packFilterFlags(objects, activeFilters);
  (attribute.array as Float32Array).set(flags);
  attribute.needsUpdate = true;
}
