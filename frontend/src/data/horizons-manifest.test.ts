import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HorizonsManifestFormatError, moonAccuracy, parseHorizonsManifest, requestedSpans } from './horizons-manifest.js';

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
