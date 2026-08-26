import { describe, expect, it } from 'vitest';
import { ObjType, Regime, type ObjectMeta } from '../../data/catalog-types.js';
import { FLAG_VISIBLE } from './points-attributes.js';
import { classifyOrbitClass, countByOrbitClass, packFilterFlags } from './points-filters.js';

function fakeObject(regime: Regime, type: ObjType): ObjectMeta {
  return {
    norad: 'x' as ObjectMeta['norad'],
    name: 'x',
    objectId: 'x',
    type,
    regime,
    isActive: true,
    sourceType: 'live',
    epochMs: 0,
    record: {} as ObjectMeta['record'],
  };
}

describe('classifyOrbitClass', () => {
  it('classifies debris as "debris" regardless of its regime', () => {
    expect(classifyOrbitClass(fakeObject(Regime.LEO, ObjType.Debris))).toBe('debris');
    expect(classifyOrbitClass(fakeObject(Regime.GEO, ObjType.Debris))).toBe('debris');
  });

  it('classifies non-debris objects by regime', () => {
    expect(classifyOrbitClass(fakeObject(Regime.LEO, ObjType.Payload))).toBe('leo');
    expect(classifyOrbitClass(fakeObject(Regime.MEO, ObjType.Payload))).toBe('meo');
    expect(classifyOrbitClass(fakeObject(Regime.GEO, ObjType.RocketBody))).toBe('geo');
    expect(classifyOrbitClass(fakeObject(Regime.HEO, ObjType.Payload))).toBe('heo');
  });

  it('has no chip for a non-debris object with an unknown regime', () => {
    expect(classifyOrbitClass(fakeObject(Regime.Unknown, ObjType.Payload))).toBeNull();
  });
});

describe('packFilterFlags', () => {
  it('marks every object visible when no filter is active — the at-rest state', () => {
    const objects = [
      fakeObject(Regime.LEO, ObjType.Payload),
      fakeObject(Regime.GEO, ObjType.Debris),
    ];
    const flags = packFilterFlags(objects, new Set());
    expect(Array.from(flags)).toEqual([FLAG_VISIBLE, FLAG_VISIBLE]);
  });

  it('shows only the matching class when one filter is active', () => {
    const objects = [
      fakeObject(Regime.LEO, ObjType.Payload), // leo
      fakeObject(Regime.GEO, ObjType.Debris), // debris
    ];
    const flags = packFilterFlags(objects, new Set(['leo']));
    expect(Array.from(flags)).toEqual([FLAG_VISIBLE, 0]);
  });

  it('always shows a non-debris unknown-regime object, whatever filters are active', () => {
    const objects = [fakeObject(Regime.Unknown, ObjType.Payload)];
    const flags = packFilterFlags(objects, new Set(['leo'])); // does not match 'leo'
    expect(Array.from(flags)).toEqual([FLAG_VISIBLE]);
  });

  it('hides everything matching classes not in a non-empty filter set', () => {
    const objects = [fakeObject(Regime.MEO, ObjType.Payload)];
    const flags = packFilterFlags(objects, new Set(['leo']));
    expect(Array.from(flags)).toEqual([0]);
  });
});

describe('countByOrbitClass', () => {
  it('tallies each object into exactly one of the five chip classes', () => {
    const objects = [
      fakeObject(Regime.LEO, ObjType.Payload),
      fakeObject(Regime.LEO, ObjType.Debris),
      fakeObject(Regime.GEO, ObjType.Payload),
    ];
    expect(countByOrbitClass(objects)).toEqual({ leo: 1, meo: 0, geo: 1, heo: 0, debris: 1 });
  });

  it('does not count a non-debris unknown-regime object in any chip', () => {
    const objects = [fakeObject(Regime.Unknown, ObjType.Payload)];
    expect(countByOrbitClass(objects)).toEqual({ leo: 0, meo: 0, geo: 0, heo: 0, debris: 0 });
  });
});
