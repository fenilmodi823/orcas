import { ObjType, Regime, type ObjectMeta } from '../../data/catalog-types.js';
import { FEATURED_OBJECT_NAMES } from '../paths/featured-norads.js';

/**
 * Cheapest signal available pre-SATCAT (`memory.md` Next actions #3): an
 * orbit-class weight, ascending "most significant first." Debris sorts
 * last regardless of its regime — a piece of LEO debris is not more
 * significant than an operational GEO comsat. GEO/MEO ahead of LEO is a
 * judgment call (fewer, larger, individually-recognisable payloads vs. a
 * shell dominated by small objects and debris), not a measured signal —
 * provisional until real RCS from the SATCAT ingest replaces it.
 */
function classWeight(object: ObjectMeta): number {
  if (object.type === ObjType.Debris) return 5;
  switch (object.regime) {
    case Regime.GEO:
      return 0;
    case Regime.MEO:
      return 1;
    case Regime.HEO:
      return 2;
    case Regime.LEO:
      return 3;
    default:
      return 4;
  }
}

/**
 * A deterministic total order over the catalogue for the density slider
 * (P4.D26): every featured object's rank is lower than every non-featured
 * object's rank ("rank 0 = featured" as a bucket, brief §13.4), then
 * `classWeight`, then `MEAN_MOTION` and finally the catalogue index itself
 * as a final, always-distinct tiebreaker — so the order never depends on
 * `Math.random` or object identity/insertion order, and calling this twice
 * on the same input returns the same array both times.
 *
 * `Uint16Array` per the design spec: fine at today's ~16.5k catalogue and
 * the ~46k the brief plans around; would need widening only if the
 * catalogue itself ever exceeds 65,535 rows (full SATCAT is ~70.5k) — a
 * future concern for whoever does that ingest, not this slider.
 */
export function computeRanks(objects: readonly ObjectMeta[]): Uint16Array {
  const n = objects.length;
  const indices = new Array<number>(n);
  for (let i = 0; i < n; i++) indices[i] = i;

  indices.sort((a, b) => {
    const featuredA = FEATURED_OBJECT_NAMES.has(objects[a].name) ? 0 : 1;
    const featuredB = FEATURED_OBJECT_NAMES.has(objects[b].name) ? 0 : 1;
    if (featuredA !== featuredB) return featuredA - featuredB;

    const classA = classWeight(objects[a]);
    const classB = classWeight(objects[b]);
    if (classA !== classB) return classA - classB;

    const motionA = objects[a].record.MEAN_MOTION;
    const motionB = objects[b].record.MEAN_MOTION;
    if (motionA !== motionB) return motionA - motionB;

    return a - b; // catalogue index: always distinct, so the order is total
  });

  const ranks = new Uint16Array(n);
  for (let rank = 0; rank < n; rank++) ranks[indices[rank]] = rank;
  return ranks;
}
