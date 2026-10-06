import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePlanetEphemeris } from '../data/planet-ephemeris.js';
import { bodyById } from '../renderer/solar/bodies.js';
import { bodyDetailGroups, bodyReadouts } from './body-detail.js';

const file = readFileSync(resolve(process.cwd(), 'public/ephemeris/planets-de421.bin'));
const ephemeris = parsePlanetEphemeris(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
const AT_MS = Date.UTC(2026, 9, 6, 12);
const body = (id: string) => {
  const b = bodyById(id);
  if (!b) throw new Error(id);
  return b;
};

describe('bodyReadouts (S5a)', () => {
  it('gives a planet its distance from the Earth and the Sun in AU, and its light time in minutes', () => {
    const rows = bodyReadouts(body('jupiter'), AT_MS, ephemeris);
    expect(rows?.map((r) => [r.label, r.unit])).toEqual([
      ['Earth', 'AU'],
      ['Sun', 'AU'],
      ['Light', 'min'],
    ]);
    const earthAu = Number(rows?.[0]?.value);
    const lightMin = Number(rows?.[2]?.value);
    expect(earthAu).toBeGreaterThan(3.9); // Jupiter is 3.9–6.5 AU from the Earth
    expect(earthAu).toBeLessThan(6.5);
    expect(lightMin).toBeCloseTo((earthAu * 149_597_870.7) / 299_792.458 / 60, 6);
  });

  it('gives the Moon kilometres and seconds', () => {
    const rows = bodyReadouts(body('moon'), AT_MS, ephemeris);
    expect(rows?.[0]?.unit).toBe('km');
    expect(Number(rows?.[0]?.value)).toBeGreaterThan(356_000);
    expect(Number(rows?.[0]?.value)).toBeLessThan(407_000);
    expect(rows?.[2]?.unit).toBe('s');
  });

  it('never measures a body from itself', () => {
    expect(bodyReadouts(body('earth'), AT_MS, ephemeris)?.map((r) => r.label)).toEqual(['Sun', 'Light']);
    expect(bodyReadouts(body('sun'), AT_MS, ephemeris)?.map((r) => r.label)).toEqual(['Earth', 'Light']);
  });

  it('says nothing about a planet before its data has loaded', () => {
    expect(bodyReadouts(body('mars'), AT_MS, null)).toBeNull();
  });
});

describe('bodyDetailGroups', () => {
  it('names the barycentre where DE421 gives only that', () => {
    const groups = bodyDetailGroups(body('saturn'), true);
    expect(groups.find((g) => g.id === 'provenance')?.note).toContain('barycentre');
    expect(bodyDetailGroups(body('mars'), true).find((g) => g.id === 'provenance')?.note).not.toContain('barycentre');
  });

  it('states the Moon’s measured error rather than DE421’s', () => {
    const note = bodyDetailGroups(body('moon'), true).find((g) => g.id === 'provenance')?.note ?? '';
    expect(note).toContain('0.0127°');
    expect(note).toContain('22.3 km');
  });

  it('says when the Sun is the analytic stand-in', () => {
    const note = bodyDetailGroups(body('sun'), false).find((g) => g.id === 'provenance')?.note ?? '';
    expect(note).toMatch(/until it loads/i);
  });
});

describe('bodyDetailGroups: maps and rings (S5b)', () => {
  const group = (id: string, groupId: string) => bodyDetailGroups(body(id), true).find((g) => g.id === groupId);

  it('names a planet’s map, its date, and that its clouds have moved', () => {
    const map = group('jupiter', 'map');
    expect(map?.fields[0]?.value).toBe('Hubble OPAL, Dec 2025');
    expect(map?.note).toContain('CC BY 4.0');
    expect(map?.note).toContain('clouds have moved');
  });

  it('says why Venus has no map, rather than leaving it out', () => {
    const map = group('venus', 'map');
    expect(map?.fields[0]?.value).toBe('None');
    expect(map?.note).toContain('radar');
  });

  it('gives Saturn its rings’ sources, and no other body a rings group', () => {
    expect(group('saturn', 'rings')?.note).toContain('Cassini UVIS');
    expect(group('jupiter', 'rings')).toBeUndefined();
  });

  it('claims IAU spin only for the planets ORCAS turns by it', () => {
    expect(group('mars', 'identity')?.note).toContain('pole and spin');
    expect(group('earth', 'identity')?.note).not.toContain('spin');
    expect(group('moon', 'identity')?.note).not.toContain('spin');
    expect(group('earth', 'map')).toBeUndefined();
  });
});
