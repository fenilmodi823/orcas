import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bodyById } from './bodies.js';
import { CENTRE_BODY, SPACECRAFT } from './spacecraft.js';

const manifest = JSON.parse(
  readFileSync(resolve(process.cwd(), 'public/ephemeris/horizons/manifest.json'), 'utf8'),
) as {
  objects: Record<string, { name: string }>;
  series: { target: number; centre: number; start: string; stop: string }[];
};

describe('the spacecraft list (S6c)', () => {
  it('is exactly the export’s 25, with its names and data years', () => {
    const fromManifest = Object.entries(manifest.objects).filter(([id]) => Number(id) < 0);
    expect(SPACECRAFT.map((s) => s.naifId)).toEqual(fromManifest.map(([id]) => Number(id)));
    for (const s of SPACECRAFT) {
      const series = manifest.series.filter((x) => x.target === s.naifId);
      expect(s.name).toBe(manifest.objects[String(s.naifId)]?.name);
      expect(s.years).toEqual([
        Number(series.map((x) => x.start).sort()[0]?.slice(0, 4)),
        Number(series.map((x) => x.stop).sort().at(-1)?.slice(0, 4)),
      ]);
    }
  });

  it('has URL-safe ids that are never all digits and never a body’s', () => {
    for (const s of SPACECRAFT) {
      expect(s.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(bodyById(s.id)).toBeUndefined();
    }
    expect(new Set(SPACECRAFT.map((s) => s.id)).size).toBe(SPACECRAFT.length);
  });

  it('names the body of every centre the series use, and each body exists', () => {
    for (const centre of new Set(manifest.series.filter((x) => x.target < 0).map((x) => x.centre))) {
      expect(CENTRE_BODY[centre], `centre ${centre}`).toBeDefined();
    }
    for (const { bodyId } of Object.values(CENTRE_BODY)) expect(bodyById(bodyId)).toBeDefined();
  });
});
