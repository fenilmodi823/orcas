import { describe, expect, it } from 'vitest';
import type { ObjectMeta, NoradId } from '../../data/catalog-types.js';
import { FEATURED_OBJECT_IDS, featuredIndices } from './featured-norads.js';

function obj(name: string, objectId: string, norad: string): ObjectMeta {
  return { name, objectId, norad: norad as NoradId } as unknown as ObjectMeta;
}

describe('FEATURED_OBJECT_IDS', () => {
  it('is a non-empty set of international designators (YYYY-NNNP)', () => {
    expect(FEATURED_OBJECT_IDS.size).toBeGreaterThan(0);
    for (const id of FEATURED_OBJECT_IDS) expect(id).toMatch(/^\d{4}-\d{3}[A-Z]{1,3}$/);
  });

  it('includes the ISS', () => {
    expect(FEATURED_OBJECT_IDS.has('1998-067A')).toBe(true);
  });
});

describe('featuredIndices', () => {
  it('writes the index of every catalogue object whose designator is featured', () => {
    const objects = [obj('NOISE-1', '2000-001A', '1'), obj('ISS (ZARYA)', '1998-067A', '25544'), obj('NOISE-2', '2000-002A', '2')];
    const out = new Uint32Array(8);
    const n = featuredIndices(objects, out);
    expect(n).toBe(1);
    expect(out[0]).toBe(1);
  });

  it('matches whatever the source calls the object — Space-Track and CelesTrak names differ', () => {
    // Space-Track's names for two featured objects, as in the 2026-09-29
    // snapshot; the CelesTrak names the old list used matched neither.
    const objects = [obj('CSS (TIANHE-1)', '2021-035A', '48274'), obj('BEIDOU 3', '2010-001A', '36287')];
    const out = new Uint32Array(8);
    expect(featuredIndices(objects, out)).toBe(2);
  });

  it('silently skips featured objects not in the catalogue', () => {
    const objects = [obj('NOISE-1', '2000-001A', '1')];
    const out = new Uint32Array(8);
    expect(featuredIndices(objects, out)).toBe(0);
  });

  it('never writes past the end of out', () => {
    const objects = [obj('ISS (ZARYA)', '1998-067A', '25544'), obj('ISS (ZARYA)', '1998-067A', '25544')];
    const out = new Uint32Array(1);
    expect(featuredIndices(objects, out)).toBe(1);
  });
});
