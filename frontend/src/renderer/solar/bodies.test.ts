import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { moonPositionJ2000Km, sunPositionJ2000Km } from '@orcas/physics';
import { bodyStateKm, parsePlanetEphemeris } from '../../data/planet-ephemeris.js';
import { BODIES, bodyById, bodyPositionKm, isBodyId } from './bodies.js';

const file = readFileSync(resolve(process.cwd(), 'public/ephemeris/planets-de421.bin'));
const ephemeris = parsePlanetEphemeris(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
const AT_MS = Date.UTC(2026, 9, 6, 12);

describe('the selectable bodies (S5a)', () => {
  it('are the Sun, the eight planets and the Moon, with URL-safe ids', () => {
    expect(BODIES.map((b) => b.id)).toEqual(['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);
    expect(BODIES.every((b) => /^[a-z]+$/.test(b.id))).toBe(true);
  });

  it('never mistakes a NORAD catalogue number for a body', () => {
    expect(isBodyId('jupiter')).toBe(true);
    expect(isBodyId('25544')).toBe(false);
    expect(isBodyId('Jupiter')).toBe(false);
    expect(bodyById('pluto')).toBeUndefined();
  });

  it('puts the Moon under the Earth, and everything else at the top', () => {
    expect(bodyById('moon')?.parent).toBe('earth');
    expect(BODIES.filter((b) => b.id !== 'moon').every((b) => b.parent === null)).toBe(true);
  });
});

describe('bodyPositionKm', () => {
  const out = new Vector3();

  it('places the Earth at the origin', () => {
    const earth = bodyById('earth');
    expect(earth && bodyPositionKm(earth, AT_MS, ephemeris, out)?.length()).toBe(0);
  });

  it('places a planet where the bake puts it, relative to the Earth', () => {
    const jupiter = bodyById('jupiter');
    const j = bodyStateKm(ephemeris, 5, AT_MS);
    const e = bodyStateKm(ephemeris, 399, AT_MS);
    const p = jupiter && bodyPositionKm(jupiter, AT_MS, ephemeris, out);
    if (!p || !j || !e) throw new Error('missing data');
    expect(p.x).toBeCloseTo(j.position.x - e.position.x, 3);
    expect(p.z).toBeCloseTo(j.position.z - e.position.z, 3);
  });

  it('has no planet before the bake loads, but keeps the analytic Sun and Moon', () => {
    const mars = bodyById('mars');
    const sun = bodyById('sun');
    const moon = bodyById('moon');
    if (!mars || !sun || !moon) throw new Error('missing body');
    expect(bodyPositionKm(mars, AT_MS, null, out)).toBeNull();
    const s = sunPositionJ2000Km(new Date(AT_MS));
    expect(bodyPositionKm(sun, AT_MS, null, out)?.x).toBeCloseTo(s.x, 6);
    const m = moonPositionJ2000Km(new Date(AT_MS));
    expect(bodyPositionKm(moon, AT_MS, ephemeris, out)?.y).toBeCloseTo(m.y, 6);
  });

  it('uses DE421’s Sun once the bake has loaded', () => {
    const sun = bodyById('sun');
    const s = bodyStateKm(ephemeris, 10, AT_MS);
    const e = bodyStateKm(ephemeris, 399, AT_MS);
    const p = sun && bodyPositionKm(sun, AT_MS, ephemeris, out);
    if (!p || !s || !e) throw new Error('missing data');
    expect(p.y).toBeCloseTo(s.position.y - e.position.y, 3);
  });
});
