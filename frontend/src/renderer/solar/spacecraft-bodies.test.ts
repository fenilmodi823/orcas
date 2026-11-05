// frontend/src/renderer/solar/spacecraft-bodies.test.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PerspectiveCamera, type Vector3 } from 'three';
import { parseHorizonsEphemeris } from '../../data/horizons-ephemeris.js';
import { createHorizonsIndex } from '../../data/horizons-index.js';
import { parseHorizonsManifest, type HorizonsManifest } from '../../data/horizons-manifest.js';
import { resetMoonSystems } from '../../data/moon-systems.js';
import { parsePlanetEphemeris, type PlanetEphemeris } from '../../data/planet-ephemeris.js';
import { SPACECRAFT } from './spacecraft.js';
import { createSpacecraftBodies, SPACECRAFT_LOAD_DISTANCE_KM } from './spacecraft-bodies.js';

const read = (path: string) => {
  const f = readFileSync(resolve(process.cwd(), path));
  return f.buffer.slice(f.byteOffset, f.byteOffset + f.byteLength);
};
const viewport = { cssWidth: 800, cssHeight: 800, dpr: 1 };
const at = (id: string) => SPACECRAFT.findIndex((s) => s.id === id);
const camera = (z: number) => {
  const c = new PerspectiveCamera(35, 1, 1, 1e10);
  c.position.set(0, 0, z);
  c.updateMatrixWorld();
  return c;
};
interface HasGeometry {
  geometry: { getAttribute(name: string): unknown };
}
const dataOf = (line: HasGeometry, name: string) => (line.geometry.getAttribute(name) as { data: { array: Float32Array } }).data.array;
const alphaOn = (line: HasGeometry): number => {
  const data = dataOf(line, 'instanceColorStart');
  let on = 0;
  for (let i = 0; i < data.length / 8; i++) if (data[i * 8 + 3]! > 0 || data[i * 8 + 7]! > 0) on += 1;
  return on;
};

let planets: PlanetEphemeris;
let manifest: HorizonsManifest;
beforeAll(() => {
  planets = parsePlanetEphemeris(read('public/ephemeris/planets-de421.bin'));
  manifest = parseHorizonsManifest(JSON.parse(readFileSync(resolve(process.cwd(), 'public/ephemeris/horizons/manifest.json'), 'utf8')) as unknown);
});
afterEach(() => resetMoonSystems());
const load = () => resetMoonSystems({ spacecraft: createHorizonsIndex(parseHorizonsEphemeris(read('public/ephemeris/horizons/spacecraft.bin'))) });
const make = (...args: [] | [HorizonsManifest | null | undefined]) => {
  const m = args.length ? args[0] : manifest;
  const request = vi.fn();
  const loadManifest = vi.fn(() => Promise.resolve(null));
  const craft = createSpacecraftBodies({ request, loadManifest, manifestNow: () => m });
  return { craft, request, loadManifest };
};
const NOV_4 = Date.UTC(2026, 10, 4);

describe('spacecraft on screen (S6c1)', () => {
  it('fetches nothing at the boot camera, and fetches past 2e6 km or for a spacecraft hovered or selected', () => {
    const { craft, request, loadManifest } = make();
    craft.update(NOV_4, planets, camera(40_000), viewport, null, null);
    craft.update(NOV_4, planets, camera(40_000), viewport, 'earth', 'moon');
    expect(request).not.toHaveBeenCalled();
    expect(loadManifest).not.toHaveBeenCalled();
    craft.update(NOV_4, planets, camera(SPACECRAFT_LOAD_DISTANCE_KM * 1.01), viewport, null, null);
    expect(request).toHaveBeenCalledWith('spacecraft');
    expect(loadManifest).toHaveBeenCalled();
    const hover = make();
    hover.craft.update(NOV_4, planets, camera(40_000), viewport, 'voyager-1', null);
    expect(hover.request).toHaveBeenCalledWith('spacecraft');
    const pick = make();
    pick.craft.update(NOV_4, planets, camera(40_000), viewport, null, 'juno');
    expect(pick.loadManifest).toHaveBeenCalled();
    for (const c of [craft, hover.craft, pick.craft]) c.dispose();
  });

  it('draws exactly the 16 with data on 2026-11-04, and hides Galileo and MAVEN with their trails', () => {
    load();
    const { craft } = make();
    craft.update(NOV_4, planets, camera(7e8), viewport, null, null);
    expect(craft.drawn.filter(Boolean)).toHaveLength(16);
    expect(craft.drawn[at('galileo')]).toBe(false);
    expect(craft.drawn[at('maven')]).toBe(false);
    for (const id of ['galileo', 'maven']) expect(craft.trails[at(id)]?.visible).toBe(false);
    expect(craft.trails.filter((t) => t.visible).length).toBeGreaterThan(0);
    craft.dispose();
  });

  it.each([undefined, null])('draws dots but no trail when the manifest is %s', (m) => {
    load();
    const { craft } = make(m);
    craft.update(NOV_4, planets, camera(7e8), viewport, null, 'voyager-1');
    expect(craft.drawn.filter(Boolean)).toHaveLength(16);
    expect(craft.trails.some((t) => t.visible)).toBe(false);
    expect(craft.path.visible).toBe(false);
    craft.dispose();
  });

  it('places a trail camera-relative, tapered, ending at the spacecraft; hover is 4 px and full opacity', () => {
    load();
    const { craft } = make();
    const cam = camera(7e8);
    const i = at('voyager-1');
    craft.update(NOV_4, planets, cam, viewport, null, null);
    const trail = craft.trails[i]!;
    expect(trail.visible).toBe(true);
    expect(trail.position.toArray()).toEqual(cam.position.toArray());
    expect(trail.geometry.getAttribute('instanceWidthStart')).toBeDefined();
    expect(trail.material.linewidth).toBe(2);
    const seg = dataOf(trail, 'instanceStart');
    const sc = craft.scKm[i] as Vector3;
    expect(seg[seg.length - 3]).toBeCloseTo(sc.x - cam.position.x, -3);
    expect(seg[seg.length - 1]).toBeCloseTo(sc.z - cam.position.z, -3);
    const colours = dataOf(trail, 'instanceColorStart');
    const alphas = Array.from(colours).filter((_, k) => k % 4 === 3);
    expect(Math.max(...alphas)).toBeGreaterThan(0.5); // base alpha 0.7 × i / last, dashes and breaks aside
    expect(Math.max(...alphas)).toBeLessThanOrEqual(0.7 + 1e-6);
    craft.update(NOV_4, planets, cam, viewport, 'voyager-1', null);
    expect(craft.trails[i]!.material.linewidth).toBe(4);
    expect(craft.trails[i]!.material.opacity).toBeCloseTo(1 / 0.7, 9);
    craft.dispose();
  });

  it("builds the selected spacecraft's path once, and again when its centre changes (Juno, 2016-06-01)", () => {
    load();
    const { craft } = make();
    const cam = camera(7e8);
    craft.update(Date.UTC(2016, 4, 1), planets, cam, viewport, null, 'juno');
    expect(craft.selectedPathKey()).toBe('-61:0');
    const cruise = alphaOn(craft.path);
    expect(craft.path.visible).toBe(true);
    craft.update(Date.UTC(2016, 4, 1) + 1000, planets, cam, viewport, null, 'juno');
    expect(craft.selectedPathKey()).toBe('-61:0');
    craft.update(Date.UTC(2016, 5, 3), planets, cam, viewport, null, 'juno');
    expect(craft.selectedPathKey()).toBe('-61:5');
    const orbit = alphaOn(craft.path);
    expect(orbit).toBeGreaterThan(0);
    expect(orbit).not.toBe(cruise); // no segment draws from cruise: only the frame's own stretch
    craft.update(Date.UTC(2016, 5, 3), planets, cam, viewport, null, null);
    expect(craft.path.visible).toBe(false);
    craft.dispose();
  });

  it('hides everything first, so a frame with no planets leaves no stale dot or line', () => {
    load();
    const { craft } = make();
    craft.update(NOV_4, planets, camera(7e8), viewport, null, 'voyager-1');
    craft.update(NOV_4, null, camera(7e8), viewport, null, 'voyager-1');
    expect(craft.drawn[at('voyager-1')]).toBe(false);
    expect(craft.trails[at('voyager-1')]?.visible).toBe(false);
    expect(craft.path.visible).toBe(false);
    craft.dispose();
  });
});
