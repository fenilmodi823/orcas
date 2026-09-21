import { describe, expect, it } from 'vitest';
import { buildSnapshot } from './catalog-snapshot.js';
import type { OmmRecord } from '@orcas/physics';

const NOW_MS = Date.parse('2026-08-22T00:00:00.000Z');

function fixture(overrides: Partial<OmmRecord> = {}): OmmRecord {
  return {
    OBJECT_NAME: 'ORCAS-TEST-SAT',
    OBJECT_ID: '1998-999Z',
    EPOCH: '2026-08-21T00:00:00.000000',
    MEAN_MOTION: 15.5,
    ECCENTRICITY: 0.0001,
    INCLINATION: 51.6,
    RA_OF_ASC_NODE: 0,
    ARG_OF_PERICENTER: 0,
    MEAN_ANOMALY: 0,
    EPHEMERIS_TYPE: 0,
    CLASSIFICATION_TYPE: 'U',
    NORAD_CAT_ID: '90001',
    ELEMENT_SET_NO: 999,
    REV_AT_EPOCH: 1,
    BSTAR: 0,
    MEAN_MOTION_DOT: 0,
    MEAN_MOTION_DDOT: 0,
    ...overrides,
  };
}

describe('buildSnapshot', () => {
  it('builds a valid snapshot from well-formed records', () => {
    const snapshot = buildSnapshot(
      [fixture({ NORAD_CAT_ID: '90001' }), fixture({ NORAD_CAT_ID: '90002' })],
      NOW_MS,
    );
    expect(snapshot.objects).toHaveLength(2);
    expect(snapshot.rejected).toHaveLength(0);
    expect(snapshot.byNorad['90001']).toBe(0);
    expect(snapshot.byNorad['90002']).toBe(1);
    expect(snapshot.fetchedAtMs).toBe(NOW_MS);
  });

  it('rejects malformed records without throwing, and keeps their reason', () => {
    const snapshot = buildSnapshot(
      [fixture({ NORAD_CAT_ID: '90001' }), { OBJECT_NAME: 'incomplete' }, 'not even an object'],
      NOW_MS,
    );
    expect(snapshot.objects).toHaveLength(1);
    expect(snapshot.rejected).toHaveLength(2);
    expect(snapshot.rejected.every((r) => r.reason === 'missing-required-field')).toBe(true);
  });

  it('rejects duplicate NORAD ids, keeping the first occurrence', () => {
    const snapshot = buildSnapshot(
      [
        fixture({ NORAD_CAT_ID: '90001', OBJECT_NAME: 'FIRST' }),
        fixture({ NORAD_CAT_ID: '90001', OBJECT_NAME: 'SECOND' }),
      ],
      NOW_MS,
    );
    expect(snapshot.objects).toHaveLength(1);
    expect(snapshot.objects[0]?.name).toBe('FIRST');
    expect(snapshot.rejected).toHaveLength(1);
    expect(snapshot.rejected[0]?.reason).toBe('duplicate-norad-id');
  });

  it('assigns increasing version numbers across calls', () => {
    const first = buildSnapshot([], NOW_MS);
    const second = buildSnapshot([], NOW_MS);
    expect(second.version).toBeGreaterThan(first.version);
  });

  it('is deeply frozen — the top-level object, the arrays, the index, and every entry', () => {
    const snapshot = buildSnapshot([fixture({ NORAD_CAT_ID: '90001' })], NOW_MS);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.objects)).toBe(true);
    expect(Object.isFrozen(snapshot.byNorad)).toBe(true);
    expect(Object.isFrozen(snapshot.rejected)).toBe(true);
    expect(Object.isFrozen(snapshot.objects[0])).toBe(true);

    // ESM modules run in strict mode, so writing to a frozen property
    // throws rather than silently no-op'ing — assert the throw itself.
    expect(() => {
      (snapshot as { version: number }).version = 999;
    }).toThrow(TypeError);
  });

  it('parses 46,000 synthetic records, every one present', () => {
    const records = Array.from({ length: 46000 }, (_, i) =>
      fixture({ NORAD_CAT_ID: String(90000 + i) }),
    );

    expect(buildSnapshot(records, NOW_MS).objects).toHaveLength(46000);
  });

  // The 800 ms budget is a performance requirement, so it runs as a
  // performance test: deliberately, on a quiet machine, with ORCAS_PERF=1.
  // In the unit suite it measured machine load instead of the parser — 1136 ms
  // on 2026-08-29 and ~1090 ms per parse on 2026-09-21 with the dev server and
  // several WebGL tabs running, against a clean pass in isolation every time.
  // Best-of-three survived momentary contention but not sustained load. The
  // budget itself is unchanged.
  //   docker compose run --rm -e ORCAS_PERF=1 frontend npx vitest run src/data/catalog-snapshot.test.ts
  it.runIf(process.env.ORCAS_PERF === '1')('parses 46,000 records inside the 800 ms budget', () => {
    const records = Array.from({ length: 46000 }, (_, i) =>
      fixture({ NORAD_CAT_ID: String(90000 + i) }),
    );

    // Best of three: contention can only make a run slower.
    let fastestMs = Infinity;
    buildSnapshot(records, NOW_MS); // warm the JIT
    for (let run = 0; run < 3; run += 1) {
      const start = performance.now();
      buildSnapshot(records, NOW_MS);
      fastestMs = Math.min(fastestMs, performance.now() - start);
    }

    expect(fastestMs).toBeLessThan(800);
  });
});
