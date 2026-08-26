import { BufferAttribute, BufferGeometry } from 'three';
import type { ObjectMeta } from '../../data/catalog-types.js';
import { packEntityIds, packRegimes, packRadii, packVisibilityFlags } from './points-attributes.js';

/**
 * Builds the Tier 0 `THREE.BufferGeometry` (brief §B.3): one `position`
 * attribute per frame-updated object, plus four static attributes built
 * once from the catalogue. `positions` is wrapped **by reference** — the
 * caller (TierZeroPoints.tsx) mutates the same array in place every
 * frame via M1.2's FrameState and flips `needsUpdate`, so this function
 * must never copy it (that copy would be exactly the per-frame
 * allocation the milestone's DoD forbids).
 */
export function createPointsGeometry(
  objects: readonly ObjectMeta[],
  positions: Float32Array,
): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aEntityId', new BufferAttribute(packEntityIds(objects.length), 1));
  geometry.setAttribute('aRegime', new BufferAttribute(packRegimes(objects), 1));
  geometry.setAttribute('aRadius', new BufferAttribute(packRadii(objects.length), 1));
  geometry.setAttribute('aFlags', new BufferAttribute(packVisibilityFlags(objects.length), 1));
  return geometry;
}
