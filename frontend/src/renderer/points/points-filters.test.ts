import { describe, expect, it } from 'vitest';
import { ObjType, OrbitClass, type ObjectMeta } from '../../data/catalog-types.js';
import { FLAG_VISIBLE } from './points-attributes.js';
import { classifyOrbitClass, countByOrbitClass, packFilterFlags } from './points-filters.js';

function fakeObject(orbitClass: OrbitClass, type: ObjType): ObjectMeta {
  return {
    norad: 'x' as ObjectMeta['norad'],
    name: 'x',
    objectId: 'x',
    type,
    orbitClass,
    isActive: true,
    sourceType: 'live',
    epochMs: 0,
    record: {} as ObjectMeta['record'],
  };
}

describe('classifyOrbitClass', () => {
  it('classifies debris as "debris" regardless of its orbit class', () => {
    expect(classifyOrbitClass(fakeObject(OrbitClass.LEO, ObjType.Debris))).toBe('debris');
    expect(classifyOrbitClass(fakeObject(OrbitClass.GEO, ObjType.Debris))).toBe('debris');
  });

  it('classifies non-debris objects by orbit class', () => {
    expect(classifyOrbitClass(fakeObject(OrbitClass.LEO, ObjType.Payload))).toBe('leo');
    expect(classifyOrbitClass(fakeObject(OrbitClass.MEO, ObjType.Payload))).toBe('meo');
    expect(classifyOrbitClass(fakeObject(OrbitClass.GEO, ObjType.RocketBody))).toBe('geo');
    expect(classifyOrbitClass(fakeObject(OrbitClass.HEO, ObjType.Payload))).toBe('heo');
  });

  it('has no chip for a non-debris object with an unknown orbit class', () => {
    expect(classifyOrbitClass(fakeObject(OrbitClass.Unknown, ObjType.Payload))).toBeNull();
  });
});

describe('packFilterFlags', () => {
  it('marks every object visible when no filter is active — the at-rest state', () => {
    const objects = [
      fakeObject(OrbitClass.LEO, ObjType.Payload),
      fakeObject(OrbitClass.GEO, ObjType.Debris),
    ];
    const flags = packFilterFlags(objects, new Set());
    expect(Array.from(flags)).toEqual([FLAG_VISIBLE, FLAG_VISIBLE]);
  });

  it('shows only the matching class when one filter is active', () => {
    const objects = [
      fakeObject(OrbitClass.LEO, ObjType.Payload), // leo
      fakeObject(OrbitClass.GEO, ObjType.Debris), // debris
    ];
    const flags = packFilterFlags(objects, new Set(['leo']));
    expect(Array.from(flags)).toEqual([FLAG_VISIBLE, 0]);
  });

  it('always shows a non-debris unknown-orbit-class object, whatever filters are active', () => {
    const objects = [fakeObject(OrbitClass.Unknown, ObjType.Payload)];
    const flags = packFilterFlags(objects, new Set(['leo'])); // does not match 'leo'
    expect(Array.from(flags)).toEqual([FLAG_VISIBLE]);
  });

  it('hides everything matching classes not in a non-empty filter set', () => {
    const objects = [fakeObject(OrbitClass.MEO, ObjType.Payload)];
    const flags = packFilterFlags(objects, new Set(['leo']));
    expect(Array.from(flags)).toEqual([0]);
  });

  it('hides an object whose rank exceeds the density threshold', () => {
    const objects = [
      fakeObject(OrbitClass.LEO, ObjType.Payload),
      fakeObject(OrbitClass.LEO, ObjType.Payload),
      fakeObject(OrbitClass.LEO, ObjType.Payload),
    ];
    const ranks = new Uint16Array([0, 1, 2]);
    const flags = packFilterFlags(objects, new Set(), ranks, 1);
    expect(Array.from(flags)).toEqual([FLAG_VISIBLE, FLAG_VISIBLE, 0]);
  });

  it('hides an object failing either the class filter or the density threshold', () => {
    const objects = [fakeObject(OrbitClass.LEO, ObjType.Payload), fakeObject(OrbitClass.GEO, ObjType.Payload)];
    const ranks = new Uint16Array([0, 0]); // both pass density
    // 'leo' filter alone would show both; density alone would show both;
    // together, only the object matching BOTH survives.
    const flags = packFilterFlags(objects, new Set(['leo']), ranks, 0);
    expect(Array.from(flags)).toEqual([FLAG_VISIBLE, 0]);
  });

  it('ignores rank entirely when ranks/threshold are omitted — pre-M1.7b callers unaffected', () => {
    const objects = [fakeObject(OrbitClass.LEO, ObjType.Payload)];
    expect(Array.from(packFilterFlags(objects, new Set()))).toEqual([FLAG_VISIBLE]);
  });
});

describe('countByOrbitClass', () => {
  it('tallies each object into exactly one of the five chip classes', () => {
    const objects = [
      fakeObject(OrbitClass.LEO, ObjType.Payload),
      fakeObject(OrbitClass.LEO, ObjType.Debris),
      fakeObject(OrbitClass.GEO, ObjType.Payload),
    ];
    expect(countByOrbitClass(objects)).toEqual({ leo: 1, meo: 0, geo: 1, heo: 0, debris: 1 });
  });

  it('does not count a non-debris unknown-orbit-class object in any chip', () => {
    const objects = [fakeObject(OrbitClass.Unknown, ObjType.Payload)];
    expect(countByOrbitClass(objects)).toEqual({ leo: 0, meo: 0, geo: 0, heo: 0, debris: 0 });
  });
});
