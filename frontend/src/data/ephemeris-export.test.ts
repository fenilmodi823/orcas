import { describe, expect, it } from 'vitest';
import { satrecFromOmm } from '@orcas/physics';
import { makeTestCatalog } from '../simulation/test-fixtures.js';
import { ephemerisCsv, ephemerisFileName } from './ephemeris-export.js';

const { objects } = makeTestCatalog(1);
const object = objects[0];
const satrec = satrecFromOmm(object.record);
const options = { startMs: object.epochMs, durationS: 600, stepS: 60, generatedMs: Date.parse('2026-09-27T12:00:00Z') };

describe('ephemerisCsv', () => {
  const csv = ephemerisCsv(object, satrec, options);
  const lines = csv.trim().split('\n');
  const header = lines.filter((l) => l.startsWith('#'));
  const [columns, ...rows] = lines.filter((l) => !l.startsWith('#'));

  it('says what every number rests on before any number appears', () => {
    expect(header.join('\n')).toMatch(/Element-set epoch: .* UTC; source: /);
    expect(header.join('\n')).toMatch(/TEME \(km, km\/s\)/);
    expect(header.join('\n')).toMatch(/WGS84/);
    expect(header.join('\n')).toMatch(/not observations/);
    expect(lines.findIndex((l) => !l.startsWith('#'))).toBe(header.length);
  });

  it('writes one row per step, inclusive of both ends', () => {
    expect(columns.split(',')).toContain('altitude_wgs84_km');
    expect(rows).toHaveLength(11);
    expect(rows[0].split(',')[1]).toBe('0');
    expect(rows[10].split(',')[1]).toBe('600');
  });

  it('has a physically sane LEO state in every row', () => {
    for (const row of rows) {
      const cells = row.split(',').map(Number);
      const radius = Math.hypot(cells[2], cells[3], cells[4]);
      expect(radius).toBeGreaterThan(6378);
      expect(radius).toBeLessThan(8000);
      expect(cells[11]).toBeGreaterThan(6.5);
      expect(cells[11]).toBeLessThan(8.5);
    }
  });

  it('marks a truncated file as truncated instead of stopping silently', () => {
    // ~180 km with heavy drag: re-enters within days, after which SGP4 refuses.
    const reentering = satrecFromOmm({ ...object.record, MEAN_MOTION: 16.4, BSTAR: 0.05 });
    const truncated = ephemerisCsv(object, reentering, { ...options, durationS: 30 * 86_400, stepS: 3_600 });
    expect(truncated).toMatch(/# TRUNCATED: SGP4 could not propagate at /);
    const dataRows = truncated.trim().split('\n').filter((l) => !l.startsWith('#')).length - 1;
    expect(dataRows).toBeLessThan(30 * 24 + 1);
  });
});

describe('ephemerisFileName', () => {
  it('is safe on every filesystem', () => {
    expect(ephemerisFileName({ ...object, name: 'ISS (ZARYA)' }, Date.parse('2026-09-27T12:34:56Z'))).toBe(
      `ISS_ZARYA_${object.norad}_2026-09-27T12-34-56Z.csv`,
    );
  });
});
