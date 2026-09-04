import { describe, expect, it } from 'vitest';
import type { ObjectMeta, NoradId } from '../../data/catalog-types.js';
import { FEATURED_OBJECT_NAMES, featuredIndices } from './featured-norads.js';

function obj(name: string, norad: string): ObjectMeta {
  return { name, norad: norad as NoradId } as unknown as ObjectMeta;
}

describe('FEATURED_OBJECT_NAMES', () => {
  it('is a non-empty set of trimmed strings', () => {
    expect(FEATURED_OBJECT_NAMES.size).toBeGreaterThan(0);
    for (const n of FEATURED_OBJECT_NAMES) {
      expect(n).toBe(n.trim());
      expect(n.length).toBeGreaterThan(0);
    }
  });

  it('includes the ISS by its CelesTrak active-feed name', () => {
    expect(FEATURED_OBJECT_NAMES.has('ISS (ZARYA)')).toBe(true);
  });
});

describe('featuredIndices', () => {
  it('writes the index of every catalogue object whose name is featured', () => {
    const objects = [obj('NOISE-1', '1'), obj('ISS (ZARYA)', '25544'), obj('NOISE-2', '2')];
    const out = new Uint32Array(8);
    const n = featuredIndices(objects, out);
    expect(n).toBe(1);
    expect(out[0]).toBe(1);
  });

  it('silently skips featured names not in the catalogue', () => {
    const objects = [obj('NOISE-1', '1')];
    const out = new Uint32Array(8);
    expect(featuredIndices(objects, out)).toBe(0);
  });

  it('never writes past the end of out', () => {
    const objects = [obj('ISS (ZARYA)', '25544'), obj('ISS (ZARYA)', '25544')];
    const out = new Uint32Array(1);
    expect(featuredIndices(objects, out)).toBe(1);
  });
});
