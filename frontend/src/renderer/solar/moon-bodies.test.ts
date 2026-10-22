// frontend/src/renderer/solar/moon-bodies.test.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { parseHorizonsEphemeris } from '../../data/horizons-ephemeris.js';
import { createHorizonsIndex } from '../../data/horizons-index.js';
import { resetMoonSystems } from '../../data/moon-systems.js';
import { parsePlanetEphemeris } from '../../data/planet-ephemeris.js';
import { bodyById, bodyPositionKm } from './bodies.js';
import { MOONS } from './moons.js';
import { PLANETS } from './planets.js';
import { createMoonBodies, moonSunlitFraction, moonSystemFade, ownTrailFade } from './moon-bodies.js';

const read = (path: string) => {
  const f = readFileSync(resolve(process.cwd(), path));
  return f.buffer.slice(f.byteOffset, f.byteOffset + f.byteLength);
};
afterEach(() => resetMoonSystems());

describe('moon systems on screen (S6b)', () => {
  it("fade by S4's rule, measured from the planet: Jupiter's full inside 9.0 × 10⁷ km, gone by 3.6 × 10⁸", () => {
    expect(moonSystemFade('jupiter', 4.2e5)).toBe(1);
    expect(moonSystemFade('jupiter', 8.9e7)).toBe(1);
    expect(moonSystemFade('jupiter', 1.8e8)).toBeGreaterThan(0);
    expect(moonSystemFade('jupiter', 1.8e8)).toBeLessThan(1);
    expect(moonSystemFade('jupiter', 3.61e8)).toBe(0);
    expect(moonSystemFade('mars', 4.46e6)).toBe(0); // Mars's moons are gone by 4.45 × 10⁶ km
  });

  it("hide a moon's own trail as its disc grows from 20 to 30 px", () => {
    expect(ownTrailFade(10)).toBe(1);
    expect(ownTrailFade(25)).toBeCloseTo(0.5, 9);
    expect(ownTrailFade(30)).toBe(0);
  });

  it('dim a moon in its planet’s shadow, by the conical model', () => {
    const planet = new Vector3(0, 0, 0);
    const sun = new Vector3(7.8e8, 0, 0);
    expect(moonSunlitFraction(new Vector3(-421_700, 0, 0), planet, 71_492, sun)).toBe(0); // straight behind: umbra
    expect(moonSunlitFraction(new Vector3(0, 421_700, 0), planet, 71_492, sun)).toBe(1); // beside: full Sun
    const edge = moonSunlitFraction(new Vector3(-421_700, 71_492, 0), planet, 71_492, sun);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(1); // the penumbra
  });

  it("put Io in Jupiter's shadow on 2026-10-13 14:53 UTC, and in sunlight at 12:00", () => {
    resetMoonSystems({ jupiter: createHorizonsIndex(parseHorizonsEphemeris(read('public/ephemeris/horizons/moons-jupiter.bin'))) });
    const planets = parsePlanetEphemeris(read('public/ephemeris/planets-de421.bin'));
    const at = (iso: string) => {
      const t = Date.parse(iso);
      const where = (id: string) => bodyPositionKm(bodyById(id)!, t, planets, new Vector3())!;
      return moonSunlitFraction(where('io'), where('jupiter'), 71_492, where('sun'));
    };
    expect(at('2026-10-13T14:53:00Z')).toBeLessThan(0.01); // mid-eclipse: 13:44–16:02 UTC, computed for this plan
    expect(at('2026-10-13T12:00:00Z')).toBe(1);
  });

  it('hides every moon when the planets have no position (B.26)', () => {
    resetMoonSystems({ jupiter: createHorizonsIndex(parseHorizonsEphemeris(read('public/ephemeris/horizons/moons-jupiter.bin'))) });
    const planets = parsePlanetEphemeris(read('public/ephemeris/planets-de421.bin'));
    const t = Date.parse('2026-10-13T12:00:00Z');
    const planetKm = PLANETS.map((p) => bodyPositionKm(bodyById(p.name.toLowerCase())!, t, planets, new Vector3())!);
    const sunKm = bodyPositionKm(bodyById('sun')!, t, planets, new Vector3())!;
    const jupiter = planetKm[PLANETS.findIndex((p) => p.name === 'Jupiter')]!;
    const camera = new PerspectiveCamera(35, 1, 1, 1e9);
    camera.position.copy(jupiter).add(new Vector3(1e6, 0, 0));
    camera.updateMatrixWorld();
    const viewport = { cssWidth: 800, cssHeight: 800, dpr: 1 };
    const moons = createMoonBodies();
    const io = MOONS.findIndex((m) => m.id === 'io');
    moons.update(t, planets, planetKm, sunKm, camera, viewport, null, null);
    expect(moons.drawn[io]).toBe(true);
    moons.update(t, planets, null, sunKm, camera, viewport, null, null);
    expect(moons.drawn[io]).toBe(false);
    expect(moons.fade[io]).toBe(0);
    expect(moons.occluders).toHaveLength(0);
    moons.dispose();
  });
});
