import { describe, expect, it } from 'vitest';
import {
  describeOrigin,
  describeProvenance,
  formatAge,
  formatEpochUtc,
  isStale,
} from './catalog-provenance.js';
import { ObjType, OrbitClass } from './catalog-types.js';
import type { CatalogSnapshot, ObjectMeta } from './catalog-types.js';

const NOW_MS = Date.parse('2026-09-20T16:00:00.000Z');
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function object(overrides: Partial<ObjectMeta> = {}): ObjectMeta {
  return {
    norad: '25544' as ObjectMeta['norad'],
    name: 'ISS (ZARYA)',
    objectId: '1998-067A',
    type: ObjType.Payload,
    orbitClass: OrbitClass.LEO,
    isActive: true,
    sourceType: 'real',
    source: 'celestrak',
    epochMs: NOW_MS - 2 * HOUR,
    record: {} as ObjectMeta['record'],
    ...overrides,
  };
}

function snapshot(objects: ObjectMeta[], rejected = 0): CatalogSnapshot {
  return {
    version: 1,
    fetchedAtMs: NOW_MS - 5 * 60_000,
    objects,
    byNorad: {},
    rejected: Array.from({ length: rejected }, () => ({
      reason: 'invalid-field-type' as const,
      detail: 'x',
      raw: null,
    })),
  };
}

describe('describeProvenance', () => {
  it('reports every distinct source, sorted', () => {
    const result = describeProvenance(
      snapshot([
        object({ source: 'spacetrack-gp' }),
        object({ source: 'celestrak' }),
        object({ source: 'spacetrack-gp' }),
      ]),
      'live',
      NOW_MS,
    );

    expect(result.sources).toEqual(['celestrak', 'spacetrack-gp']);
  });

  it('takes the newest and oldest element-set epoch', () => {
    const result = describeProvenance(
      snapshot([
        object({ epochMs: NOW_MS - 10 * DAY }),
        object({ epochMs: NOW_MS - 1 * HOUR }),
        object({ epochMs: NOW_MS - 3 * DAY }),
      ]),
      'live',
      NOW_MS,
    );

    expect(result.newestEpochMs).toBe(NOW_MS - 1 * HOUR);
    expect(result.oldestEpochMs).toBe(NOW_MS - 10 * DAY);
    expect(result.newestEpochAgeMs).toBe(HOUR);
    expect(result.newestEpochIsAhead).toBe(false);
  });

  it('never reports a negative age when upstream publishes ahead of now', () => {
    // Space-Track's gp class really does this - TESS and both VELAs were
    // ~23 h ahead on 2026-09-20. A readout must say "published ahead", not
    // show a negative number.
    const result = describeProvenance(
      snapshot([object({ epochMs: NOW_MS + 23 * HOUR })]),
      'live',
      NOW_MS,
    );

    expect(result.newestEpochIsAhead).toBe(true);
    expect(result.newestEpochAgeMs).toBe(0);
  });

  it('keeps snapshot age and element-set epoch as separate facts', () => {
    // RA14.D6: they are never merged into one number.
    const result = describeProvenance(snapshot([object({ epochMs: NOW_MS - 3 * DAY })]), 'live', NOW_MS);

    expect(result.fetchedAgeMs).toBe(5 * 60_000);
    expect(result.newestEpochAgeMs).toBe(3 * DAY);
  });

  it('carries the rejected count so silent drops are visible', () => {
    expect(describeProvenance(snapshot([object()], 4), 'live', NOW_MS).rejectedCount).toBe(4);
  });

  it('does not divide by an empty catalogue', () => {
    const result = describeProvenance(snapshot([]), 'unavailable', NOW_MS);

    expect(result.objectCount).toBe(0);
    expect(result.sources).toEqual([]);
    expect(Number.isFinite(result.newestEpochMs)).toBe(true);
    expect(result.newestEpochAgeMs).toBe(0);
  });
});

describe('formatAge', () => {
  it.each([
    [30_000, 'just now'],
    [5 * 60_000, '5 min ago'],
    [3 * HOUR, '3 h ago'],
    [DAY, '1 day ago'],
    [9 * DAY, '9 days ago'],
  ])('formats %ims as %s', (ms, expected) => {
    expect(formatAge(ms)).toBe(expected);
  });
});

describe('formatEpochUtc', () => {
  it('shows the epoch itself, to the second, in UTC', () => {
    expect(formatEpochUtc(Date.parse('2026-09-21T14:50:11.752Z'))).toBe('2026-09-21 14:50:11 UTC');
  });
});

describe('origin labelling', () => {
  it('treats anything but a live fetch as stale', () => {
    expect(isStale('live')).toBe(false);
    expect(isStale('cached')).toBe(true);
    expect(isStale('bundled')).toBe(true);
    expect(isStale('unavailable')).toBe(true);
  });

  it('explains each origin without jargon', () => {
    expect(describeOrigin('cached')).toContain('unreachable');
    expect(describeOrigin('bundled')).toContain('sample');
  });
});
