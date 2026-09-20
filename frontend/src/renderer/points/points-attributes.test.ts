import { describe, expect, it } from 'vitest';
import { OrbitClass } from '../../data/catalog-types.js';
import type { ObjectMeta } from '../../data/catalog-types.js';
import { PLACEHOLDER_RADIUS_KM, packEntityIds, packOrbitClasses, packRadii } from './points-attributes.js';

function fakeObject(orbitClass: OrbitClass): ObjectMeta {
  return {
    norad: 'x' as ObjectMeta['norad'],
    name: 'x',
    objectId: 'x',
    type: 0,
    orbitClass,
    isActive: true,
    sourceType: 'live',
    source: 'celestrak',
    epochMs: 0,
    record: {} as ObjectMeta['record'],
  };
}

describe('packEntityIds', () => {
  it('assigns each object its own array index, as a float', () => {
    const ids = packEntityIds(5);
    expect(Array.from(ids)).toEqual([0, 1, 2, 3, 4]);
  });

  it('produces exactly `count` entries', () => {
    expect(packEntityIds(46_250)).toHaveLength(46_250);
  });
});

describe('packOrbitClasses', () => {
  it('copies each object orbit-class enum value verbatim', () => {
    const objects = [fakeObject(OrbitClass.LEO), fakeObject(OrbitClass.GEO), fakeObject(OrbitClass.HEO)];
    const orbitClasses = packOrbitClasses(objects);
    expect(Array.from(orbitClasses)).toEqual([OrbitClass.LEO, OrbitClass.GEO, OrbitClass.HEO]);
  });

  it('produces exactly one entry per object', () => {
    expect(packOrbitClasses([fakeObject(OrbitClass.LEO)])).toHaveLength(1);
  });
});

describe('packRadii', () => {
  it('fills every entry with the placeholder radius — no per-object size data exists', () => {
    // Float32Array stores Math.fround(x), not x itself — compare against
    // the same float32-rounded value rather than the float64 constant.
    const expected = Math.fround(PLACEHOLDER_RADIUS_KM);
    const radii = packRadii(4);
    expect(Array.from(radii)).toEqual([expected, expected, expected, expected]);
  });
});
