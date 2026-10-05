import type { ObjectMeta } from '../../data/catalog-types.js';

/**
 * The curated "featured" set (brief §D.4 / P4.D26 rank 0): objects that
 * always carry a permanent orbit path and an ambient label.
 *
 * Kept as **international designators** (OBJECT_ID), not names or NORAD ids.
 * Names were the first choice, but each source names objects its own way:
 * once Space-Track became the main source (2026-09-17), four of the seven
 * CelesTrak names stopped matching ("CSS (TIANHE)" is "CSS (TIANHE-1)" there,
 * "BEIDOU-2 G1" is "BEIDOU 3"), and those objects silently lost their paths.
 * A designator is the same in both. Every entry below was read from the
 * 2026-09-29 snapshot, not written from memory (CLAUDE.md: never invent a
 * number). `featuredIndices` skips any that do not resolve, so an out-of-date
 * entry degrades to "no path", never to a crash.
 *
 * This list is editorial — Fenil curates it (A.10, 2026-10-03: the ISS,
 * Tiangong, Hubble and representative navigation satellites). It is
 * deliberately short; the density slider is where "show me more" lives.
 *
 * ponytail: a static list, not a `space_object.featured` column. Promote it
 * to the backend only if it ever needs to be user-editable.
 */
export const FEATURED_OBJECT_IDS: ReadonlySet<string> = new Set<string>([
  // Crewed stations
  '1998-067A', // ISS (ZARYA), NORAD 25544
  '2021-035A', // Tiangong core module — Space-Track "CSS (TIANHE-1)", NORAD 48274
  // Great observatory
  '1990-037B', // Hubble — "HST", NORAD 20580
  // One navigation satellite per constellation — a path at MEO / GEO, not
  // just LEO.
  '1997-035A', // GPS — "NAVSTAR 43 (USA 132)", NORAD 24876
  '2011-060A', // Galileo proto-flight model — "GALILEO-PFM", NORAD 37846
  '2007-052B', // GLONASS — "COSMOS 2432 (GLONASS)", NORAD 32276
  '2010-001A', // BeiDou-2 G1, GEO — Space-Track "BEIDOU 3", NORAD 36287
]);

/** Whether an object is in the featured set. */
export function isFeatured(object: Pick<ObjectMeta, 'objectId'>): boolean {
  return FEATURED_OBJECT_IDS.has(object.objectId);
}

/**
 * Fill `out` with the catalogue indices of the featured objects, in
 * catalogue order. Returns the count written. Allocation-free; `out`
 * should be sized to `FEATURED_OBJECT_IDS.size` (a small constant).
 */
export function featuredIndices(objects: readonly ObjectMeta[], out: Uint32Array): number {
  let n = 0;
  for (let i = 0; i < objects.length && n < out.length; i++) {
    if (isFeatured(objects[i])) out[n++] = i;
  }
  return n;
}
