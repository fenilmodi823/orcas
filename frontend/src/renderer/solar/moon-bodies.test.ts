// frontend/src/renderer/solar/moon-bodies.test.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Mesh, PerspectiveCamera, Vector3, type ShaderMaterial } from 'three';
import { iauBodyAxesJ2000 } from '@orcas/physics';
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

describe('moons as they look (S6b2)', () => {
  const planets = parsePlanetEphemeris(read('public/ephemeris/planets-de421.bin'));
  const t = Date.parse('2026-10-13T12:00:00Z');
  const io = MOONS.findIndex((m) => m.id === 'io');
  const viewport = { cssWidth: 800, cssHeight: 800, dpr: 1 };

  /** Jupiter's moons placed, the camera `distanceKm` from Io; the moons updated once. */
  function setUp(distanceKm: number, loads: string[]) {
    resetMoonSystems({ jupiter: createHorizonsIndex(parseHorizonsEphemeris(read('public/ephemeris/horizons/moons-jupiter.bin'))) });
    const planetKm = PLANETS.map((p) => bodyPositionKm(bodyById(p.name.toLowerCase())!, t, planets, new Vector3())!);
    const sunKm = bodyPositionKm(bodyById('sun')!, t, planets, new Vector3())!;
    const ioKm = bodyPositionKm(bodyById('io')!, t, planets, new Vector3())!;
    const camera = new PerspectiveCamera(35, 1, 1, 1e10);
    camera.position.copy(ioKm).add(new Vector3(0, 0, distanceKm));
    camera.updateMatrixWorld();
    const moons = createMoonBodies(1, (url) => loads.push(url));
    moons.update(t, planets, planetKm, sunKm, camera, viewport, null, null);
    const mesh = moons.group.children.find((c): c is Mesh => c instanceof Mesh && c.matrix.elements[12] === ioKm.x && c.matrix.elements[13] === ioKm.y);
    return { moons, mesh, ioKm };
  }

  it("draws each moon as its IAU ellipsoid, its long axis on its prime meridian and its shortest on its pole", () => {
    const { moons, mesh, ioKm } = setUp(1e5, []);
    const axes = iauBodyAxesJ2000(501, new Date(t))!;
    const local = (x: number, y: number, z: number) => new Vector3(x, y, z).applyMatrix4(mesh!.matrix).sub(ioKm);
    const [a, b, c] = MOONS[io]!.radiiKm;
    const near = (v: Vector3, d: { x: number; y: number; z: number }, r: number) => expect(v.distanceTo(new Vector3(d.x, d.y, d.z).multiplyScalar(r))).toBeLessThan(1e-6);
    near(local(1, 0, 0), axes.x, a); // three's sphere: +x to the body's x (longitude 0)
    near(local(0, 1, 0), axes.z, c); // its +y pole to the IAU north
    near(local(0, 0, -1), axes.y, b); // and −z to 90° east
    moons.dispose();
  });

  it('hides labels and bounds the near plane by its largest radius', () => {
    const { moons } = setUp(1e5, []);
    expect(moons.occluderOf[io]?.radiusKm).toBe(1829.4);
    moons.dispose();
  });

  it("fetches a moon's map once it covers a pixel, and only once", () => {
    const far: string[] = [];
    setUp(1e9, far).moons.dispose(); // Io under a pixel at 10⁹ km
    expect(far).not.toContain('/textures/io-2048.jpg');
    const loads: string[] = [];
    const { moons } = setUp(1e5, loads);
    moons.update(t, planets, PLANETS.map((p) => bodyPositionKm(bodyById(p.name.toLowerCase())!, t, planets, new Vector3())!), bodyPositionKm(bodyById('sun')!, t, planets, new Vector3())!, new PerspectiveCamera(), viewport, 'io', null);
    expect(loads.filter((u) => u === '/textures/io-2048.jpg')).toHaveLength(1);
    moons.dispose();
  });

  it("draws Titan in its haze colour and Deimos, with no photomosaic, in the moons' flat colour", () => {
    const moons = createMoonBodies(1, () => undefined);
    const colourOf = (id: string) => {
      const i = MOONS.findIndex((m) => m.id === id);
      const mesh = moons.group.children.filter((c): c is Mesh => c instanceof Mesh)[i];
      return (mesh!.material as ShaderMaterial).uniforms.uColour!.value.getHexString();
    };
    expect(colourOf('titan')).not.toBe(colourOf('deimos'));
    expect(colourOf('deimos')).toBe(colourOf('io'));
    moons.dispose();
  });
});
