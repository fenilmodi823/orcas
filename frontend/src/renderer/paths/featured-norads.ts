import type { ObjectMeta } from '../../data/catalog-types.js';

/**
 * The curated "featured" set (brief §D.4 / P4.D26 rank 0): objects that
 * always carry a permanent orbit path.
 *
 * Kept as exact CelesTrak `OBJECT_NAME` strings, not catalogue numbers —
 * writing a NORAD id from memory is exactly the "never invent a number"
 * trap (CLAUDE.md). Names in the `GROUP=active` feed are stable and
 * well known. `featuredIndices` skips any that do not resolve, so an
 * out-of-date entry degrades to "no path", never to a crash.
 *
 * This list is editorial — Fenil curates it. It is deliberately short: a
 * handful of unmistakable objects reads better than a crowded sky of
 * thin lines, and the density slider (M1.7b stage 4) is where "show me
 * more" lives.
 *
 * ponytail: a static list, not a `space_object.featured` column. Promote
 * it to the backend only if it ever needs to be user-editable or vary
 * per deployment — a migration for a hand-maintained constant buys
 * nothing now.
 */
export const FEATURED_OBJECT_NAMES: ReadonlySet<string> = new Set<string>([
  'ISS (ZARYA)', // International Space Station
  'CSS (TIANHE)', // Tiangong core module
  'HST', // Hubble Space Telescope
  // Verify-and-extend against the live snapshot (see the plan's Task 2
  // Step 5): one GNSS representative each, and any historic craft Fenil
  // wants. Add only names confirmed present in the loaded catalogue.
]);

/**
 * Fill `out` with the catalogue indices of the featured objects, in
 * catalogue order. Returns the count written. Allocation-free; `out`
 * should be sized to `FEATURED_OBJECT_NAMES.size` (a small constant).
 */
export function featuredIndices(objects: readonly ObjectMeta[], out: Uint32Array): number {
  let n = 0;
  for (let i = 0; i < objects.length && n < out.length; i++) {
    if (FEATURED_OBJECT_NAMES.has(objects[i].name)) out[n++] = i;
  }
  return n;
}
