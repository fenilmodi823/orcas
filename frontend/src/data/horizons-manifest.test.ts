import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HorizonsManifestFormatError, flownBoundary, jumpSpans, moonAccuracy, parseHorizonsManifest, requestedSpans, sheetDateEndUtcMs, tdbLabelEtS } from './horizons-manifest.js';

const manifest = parseHorizonsManifest(JSON.parse(readFileSync(resolve(process.cwd(), 'public/ephemeris/horizons/manifest.json'), 'utf8')) as unknown);

describe('the Horizons manifest (S6a, read for the panel in S6b)', () => {
  it('names the export date, and each moon’s Horizons trajectory', () => {
    expect(manifest.exportedDate).toBe('2026-10-06');
    expect(manifest.sources.get(501)).toBe('jup365_merged');
    expect(manifest.sources.get(401)).toBe('mar099');
  });

  it("states each moon's spans as requested", () => {
    // Each span is unbreakable (no-break spaces), so a narrow panel wraps between spans, never inside one.
    expect(requestedSpans(manifest, 501)).toBe('1973-11-14\u00a0–\u00a01974-12-23 · 1979-02-14\u00a0–\u00a01979-07-30 · 1995-11-01\u00a0–\u00a02036-12-31');
  });

  it('gives the worst error measured, and counts stretches nothing measured', () => {
    expect(moonAccuracy(manifest, 501).worstMeasured).toBeLessThanOrEqual(1e-4);
    expect(moonAccuracy(manifest, 501).unmeasured).toBe(0);
    expect(moonAccuracy(manifest, 608).unmeasured).toBe(2); // Iapetus: 1979 and 2004, kept at the export step, no estimate
    expect(moonAccuracy(manifest, 401).worstMeasured).toBeNull(); // Phobos: every stretch kept at the export step…
    expect(moonAccuracy(manifest, 401).worstEstimated).toBeGreaterThan(0); // …and estimated instead
  });

  it('rejects anything malformed rather than show it', () => {
    expect(() => parseHorizonsManifest({})).toThrow(HorizonsManifestFormatError);
    expect(() => parseHorizonsManifest({ objects: {}, series: [{ target: 'x' }], requests: [] })).toThrow(HorizonsManifestFormatError);
  });
});

describe('what the manifest says about a spacecraft (S6c1)', () => {
  it('ends a sheet date with its day, month or minute', () => {
    expect(sheetDateEndUtcMs('1992-04-24')).toBe(Date.UTC(1992, 3, 25));
    expect(sheetDateEndUtcMs('2022-04')).toBe(Date.UTC(2022, 4, 1));
    expect(sheetDateEndUtcMs('2022-12-11 17:20')).toBe(Date.UTC(2022, 11, 11, 17, 20));
    expect(sheetDateEndUtcMs('2026-07-20 19:11:55')).toBe(Date.UTC(2026, 6, 20, 19, 11, 55));
    expect(() => sheetDateEndUtcMs('soon')).toThrow(HorizonsManifestFormatError);
  });

  it('reads a TDB label as ET seconds past J2000', () => {
    expect(tdbLabelEtS('2000-01-01 12:00')).toBe(0);
  });

  it('takes the fit date, then last contact, then the export', () => {
    expect(flownBoundary(manifest, -31)).toMatchObject({ kind: 'fit', utcMs: Date.UTC(1992, 3, 25) });
    expect(flownBoundary(manifest, -23)).toMatchObject({ kind: 'last-contact', utcMs: Date.UTC(2002, 2, 4) });
    expect(flownBoundary(manifest, -64)).toMatchObject({ kind: 'export', utcMs: Date.parse('2026-10-06T19:44:00.764Z') });
    expect(flownBoundary(manifest, -1024).kind).toBe('export');
    expect(flownBoundary(manifest, -31).quote).toContain('Final two-way tracking');
  });

  it("lists Artemis II's jumps as an ET span, and carries all 95", () => {
    const [span] = jumpSpans(manifest, -1024);
    expect(span?.[0]).toBeCloseTo(tdbLabelEtS('2026-04-04 17:59'), 6);
    expect(span?.[1]).toBeCloseTo(tdbLabelEtS('2026-04-05 15:19'), 6);
    expect(manifest.series.reduce((n, s) => n + s.jumps.length, 0)).toBe(95);
  });

  it('rejects a malformed boundary at the door', () => {
    expect(() => parseHorizonsManifest({ objects: { '-1': { name: 'X', fitThrough: 'later' } }, series: [], requests: [{ exportedUtc: '2026-10-06T19:44:35.498Z' }] })).toThrow(HorizonsManifestFormatError);
  });
});
