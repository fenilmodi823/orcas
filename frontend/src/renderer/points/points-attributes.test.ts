import { describe, expect, it } from 'vitest';
import { Regime } from '../../data/catalog-types.js';
import type { ObjectMeta } from '../../data/catalog-types.js';
import { PLACEHOLDER_RADIUS_KM, packEntityIds, packRegimes, packRadii } from './points-attributes.js';

function fakeObject(regime: Regime): ObjectMeta {
  return {
    norad: 'x' as ObjectMeta['norad'],
    name: 'x',
    objectId: 'x',
    type: 0,
    regime,
    isActive: true,
    sourceType: 'live',
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

describe('packRegimes', () => {
  it('copies each object regime enum value verbatim', () => {
    const objects = [fakeObject(Regime.LEO), fakeObject(Regime.GEO), fakeObject(Regime.HEO)];
    const regimes = packRegimes(objects);
    expect(Array.from(regimes)).toEqual([Regime.LEO, Regime.GEO, Regime.HEO]);
  });

  it('produces exactly one entry per object', () => {
    expect(packRegimes([fakeObject(Regime.LEO)])).toHaveLength(1);
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
