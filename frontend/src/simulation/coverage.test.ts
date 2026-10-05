import { describe, expect, it } from 'vitest';
import {
  COVERAGE_BACK_MS,
  COVERAGE_FORWARD_LEO_MS,
  COVERAGE_FORWARD_OTHER_MS,
  clampToRange,
  coverageOf,
  isOutsideCoverage,
  scrubRangeOf,
  rangeLimit,
  rangeLimitNotice,
} from './coverage.js';
import { ObjType, OrbitClass } from '../data/catalog-types.js';
import type { ObjectMeta } from '../data/catalog-types.js';

const DAY = 86_400_000;
const EPOCH = Date.parse('2026-09-20T00:00:00Z');

function object(orbitClass: OrbitClass, epochMs = EPOCH): ObjectMeta {
  return {
    norad: '25544' as ObjectMeta['norad'],
    name: 'X',
    objectId: 'X',
    type: ObjType.Payload,
    orbitClass,
    isActive: true,
    sourceType: 'real',
    source: 'celestrak',
    epochMs,
    record: {} as ObjectMeta['record'],
  };
}

describe('coverageOf', () => {
  it('trusts an element set 3 days back', () => {
    expect(coverageOf(object(OrbitClass.LEO)).startMs).toBe(EPOCH - 3 * DAY);
    expect(COVERAGE_BACK_MS).toBe(3 * DAY);
  });

  it('trusts LEO only 5 days forward - drag makes it decay fastest', () => {
    expect(coverageOf(object(OrbitClass.LEO)).endMs).toBe(EPOCH + 5 * DAY);
    expect(COVERAGE_FORWARD_LEO_MS).toBe(5 * DAY);
  });

  it.each([OrbitClass.MEO, OrbitClass.GEO, OrbitClass.HEO, OrbitClass.Unknown])(
    'trusts non-LEO class %s 14 days forward',
    (orbitClass) => {
      expect(coverageOf(object(orbitClass)).endMs).toBe(EPOCH + 14 * DAY);
      expect(COVERAGE_FORWARD_OTHER_MS).toBe(14 * DAY);
    },
  );
});

describe('scrubRangeOf', () => {
  it('is the union of every coverage window', () => {
    const range = scrubRangeOf([
      object(OrbitClass.LEO, EPOCH),
      object(OrbitClass.GEO, EPOCH - 2 * DAY),
      object(OrbitClass.LEO, EPOCH + DAY),
    ]);

    // earliest start: the GEO object 2 d earlier, minus 3 d back
    expect(range?.startMs).toBe(EPOCH - 5 * DAY);
    // latest end: the GEO object's 14 d forward from EPOCH - 2 d = EPOCH + 12 d
    expect(range?.endMs).toBe(EPOCH + 12 * DAY);
  });

  it('offers no range for an empty catalogue rather than an invented one', () => {
    expect(scrubRangeOf([])).toBeNull();
  });
});

describe('isOutsideCoverage', () => {
  const leo = object(OrbitClass.LEO);

  it('is false inside the window', () => {
    expect(isOutsideCoverage(leo, EPOCH + DAY)).toBe(false);
  });

  it('is true a day past the LEO forward limit', () => {
    expect(isOutsideCoverage(leo, EPOCH + 6 * DAY)).toBe(true);
  });

  it('is true before the back limit', () => {
    expect(isOutsideCoverage(leo, EPOCH - 4 * DAY)).toBe(true);
  });
});

describe('clampToRange', () => {
  const range = { startMs: 100, endMs: 200 };

  it('holds a time at the end-stops, like hitting a wall', () => {
    expect(clampToRange(50, range)).toBe(100);
    expect(clampToRange(250, range)).toBe(200);
    expect(clampToRange(150, range)).toBe(150);
  });
});

describe('rangeLimit (S1: stop at the edge of the data and say so, as NASA Eyes does)', () => {
  const range = { startMs: 1_000, endMs: 9_000 };

  it('is null inside the range, ends included', () => {
    expect(rangeLimit(1_000, range)).toBeNull();
    expect(rangeLimit(5_000, range)).toBeNull();
    expect(rangeLimit(9_000, range)).toBeNull();
  });

  it('names the end that was crossed and the time to stop at', () => {
    expect(rangeLimit(9_500, range)).toEqual({ side: 'end', boundMs: 9_000 });
    expect(rangeLimit(500, range)).toEqual({ side: 'start', boundMs: 1_000 });
  });
});

describe('rangeLimitNotice', () => {
  it('says where the clock stopped and why, in UTC', () => {
    const endMs = Date.UTC(2026, 9, 12, 22, 25, 48);
    expect(rangeLimitNotice({ side: 'end', boundMs: endMs })).toBe(
      'Stopped at 2026-10-12 22:25:48 UTC: no element set covers a later time.',
    );
    expect(rangeLimitNotice({ side: 'start', boundMs: endMs })).toMatch(/covers an earlier time\.$/);
  });
});
