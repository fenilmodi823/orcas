import { describe, expect, it } from 'vitest';
import { ObjType, Regime, type ObjectMeta } from '../../data/catalog-types.js';
import { computeRanks, densityVisibleCount } from './significance-rank.js';

function fakeObject(name: string, regime: Regime, type: ObjType, meanMotion: number): ObjectMeta {
  return {
    norad: name as ObjectMeta['norad'],
    name,
    objectId: name,
    type,
    regime,
    isActive: true,
    sourceType: 'live',
    epochMs: 0,
    record: { MEAN_MOTION: meanMotion } as ObjectMeta['record'],
  };
}

describe('computeRanks', () => {
  it('returns the same array twice for the same input — no random ties', () => {
    const objects = [
      fakeObject('a', Regime.LEO, ObjType.Payload, 15),
      fakeObject('b', Regime.GEO, ObjType.Payload, 1),
      fakeObject('c', Regime.LEO, ObjType.Debris, 14),
    ];
    expect(Array.from(computeRanks(objects))).toEqual(Array.from(computeRanks(objects)));
  });

  it('ranks every featured object below every non-featured object', () => {
    const objects = [
      fakeObject('some random debris', Regime.LEO, ObjType.Debris, 15),
      fakeObject('ISS (ZARYA)', Regime.LEO, ObjType.Payload, 15.5),
      fakeObject('another satellite', Regime.GEO, ObjType.Payload, 1),
      fakeObject('HST', Regime.LEO, ObjType.Payload, 15.1),
    ];
    const ranks = computeRanks(objects);
    const featuredRanks = [ranks[1], ranks[3]]; // ISS, HST
    const nonFeaturedRanks = [ranks[0], ranks[2]];
    expect(Math.max(...featuredRanks)).toBeLessThan(Math.min(...nonFeaturedRanks));
  });

  it('produces a total order: every rank 0..n-1 appears exactly once', () => {
    const objects = [
      fakeObject('a', Regime.LEO, ObjType.Payload, 15),
      fakeObject('b', Regime.LEO, ObjType.Payload, 15), // same class and mean motion as 'a'
      fakeObject('c', Regime.GEO, ObjType.Debris, 1),
      fakeObject('d', Regime.MEO, ObjType.Payload, 2),
    ];
    const ranks = Array.from(computeRanks(objects));
    expect(new Set(ranks).size).toBe(objects.length);
    expect(ranks.slice().sort((x, y) => x - y)).toEqual([0, 1, 2, 3]);
  });

  it('sorts debris last regardless of regime', () => {
    const objects = [
      fakeObject('geo debris', Regime.GEO, ObjType.Debris, 1),
      fakeObject('leo payload', Regime.LEO, ObjType.Payload, 15),
    ];
    const ranks = computeRanks(objects);
    expect(ranks[1]).toBeLessThan(ranks[0]); // the payload outranks the debris
  });

  it('falls back to the catalogue index when class and mean motion tie', () => {
    const objects = [
      fakeObject('a', Regime.LEO, ObjType.Payload, 15),
      fakeObject('b', Regime.LEO, ObjType.Payload, 15),
    ];
    const ranks = computeRanks(objects);
    expect(ranks[0]).toBeLessThan(ranks[1]); // index 0 breaks the tie ahead of index 1
  });
});

describe('densityVisibleCount', () => {
  const objects = [
    fakeObject('ISS (ZARYA)', Regime.LEO, ObjType.Payload, 15.5), // featured
    fakeObject('HST', Regime.LEO, ObjType.Payload, 15.1), // featured
    fakeObject('a', Regime.LEO, ObjType.Payload, 15),
    fakeObject('b', Regime.MEO, ObjType.Payload, 2),
    fakeObject('c', Regime.GEO, ObjType.Debris, 1),
  ];

  it('floors at the featured count at 0%, never showing nothing', () => {
    expect(densityVisibleCount(objects, 0)).toBe(2); // ISS + HST
  });

  it('shows the full catalogue at 100%', () => {
    expect(densityVisibleCount(objects, 100)).toBe(objects.length);
  });

  it('is non-decreasing as density rises — sweeping it only ever adds', () => {
    let previous = -1;
    for (let d = 0; d <= 100; d += 5) {
      const count = densityVisibleCount(objects, d);
      expect(count).toBeGreaterThanOrEqual(previous);
      previous = count;
    }
  });
});
