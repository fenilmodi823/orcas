// frontend/src/renderer/solar/spacecraft-bodies.test.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Vector3, type Points } from 'three';
import { parseHorizonsEphemeris } from '../../data/horizons-ephemeris.js';
import { createHorizonsIndex } from '../../data/horizons-index.js';
import { parseHorizonsManifest, type HorizonsManifest } from '../../data/horizons-manifest.js';
import { moonSystem, resetMoonSystems } from '../../data/moon-systems.js';
import { parsePlanetEphemeris, type PlanetEphemeris } from '../../data/planet-ephemeris.js';
import { SPACECRAFT } from './spacecraft.js';
import { centreGeocentricKm } from './system-centres.js';
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
    expect(orbit).not.toBe(cruise);
    // No segment draws from cruise: every drawn end point lies in the Jupiter-centred stretch (cruise is 5-8e8 km out).
    const t = Date.UTC(2016, 5, 3);
    const jupiter = centreGeocentricKm(5, t, planets, new Vector3())!;
    const seg = dataOf(craft.path, 'instanceStart');
    const alpha = dataOf(craft.path, 'instanceColorStart');
    let checked = 0;
    for (let k = 0; k < alpha.length / 8; k++) {
      if (!(alpha[k * 8 + 3]! > 0 || alpha[k * 8 + 7]! > 0)) continue;
      for (let e = 0; e < 2; e++) {
        const rel = new Vector3(seg[k * 6 + e * 3], seg[k * 6 + e * 3 + 1], seg[k * 6 + e * 3 + 2]).add(craft.path.position).sub(jupiter);
        expect(rel.length()).toBeLessThan(1e8);
      }
      // A segment drawn from a cruise sample would be collapsed onto the stretch's first point: zero length.
      expect(Math.hypot(seg[k * 6]! - seg[k * 6 + 3]!, seg[k * 6 + 1]! - seg[k * 6 + 4]!, seg[k * 6 + 2]! - seg[k * 6 + 5]!)).toBeGreaterThan(0);
      checked += 1;
    }
    expect(checked).toBe(orbit);
    craft.update(Date.UTC(2016, 5, 3), planets, cam, viewport, null, null);
    expect(craft.path.visible).toBe(false);
    craft.dispose();
  });

  it("sizes the predicted dashes where the camera is: 1 AU from Voyager 1, not at the barycentre 172 AU away", () => {
    load();
    const { craft } = make();
    craft.update(NOV_4, planets, camera(7e8), viewport, null, 'voyager-1');
    const near = camera(0);
    near.position.copy(craft.scKm[at('voyager-1')]!).add(new Vector3(1.496e8, 0, 0));
    near.updateMatrixWorld();
    craft.update(NOV_4, planets, near, viewport, null, 'voyager-1');
    // The last 1,000 segments (2044-2053) are all predicted; a 5e6 km segment at 1 AU is ~45 px, so one-segment dashes.
    const alpha = dataOf(craft.path, 'instanceColorStart');
    const segments = alpha.length / 8;
    let run = 0;
    let longest = 0;
    for (let k = segments - 1000; k < segments - 1; k++) {
      run = alpha[k * 8 + 3]! > 0 ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
    expect(longest).toBe(1);
    craft.dispose();
  });

  it('draws nothing, and does not throw, when the spacecraft file has failed or is absent', () => {
    resetMoonSystems();
    const { craft } = make();
    expect(() => craft.update(NOV_4, planets, camera(7e8), viewport, null, 'voyager-1')).not.toThrow();
    expect(craft.drawn.some(Boolean)).toBe(false);
    expect(craft.trails.some((t) => t.visible)).toBe(false);
    expect(craft.path.visible).toBe(false);
    const dots = craft.group.children.find((c) => c.type === 'Points') as Points;
    expect(dots.geometry.drawRange.count).toBe(0);
    craft.dispose();
  });

  it('fades a body-centred trail with distance from its centre, and never a barycentre one', () => {
    load();
    const { craft } = make();
    craft.update(NOV_4, planets, camera(7e8), viewport, null, null);
    const lro = craft.trails[at('lro')]!;
    expect(lro.visible).toBe(false); // Moon-centred, 7e8 km away: gone
    expect(lro.material.opacity).toBe(0);
    const voyager = craft.trails[at('voyager-1')]!;
    expect(voyager.visible).toBe(true);
    expect(voyager.material.opacity).toBe(1);
    craft.dispose();
  });

  it('does not resample trails while the clock stands still, and does when it moves a sample', () => {
    load();
    const index = moonSystem('spacecraft')!;
    const spy = vi.spyOn(index, 'stateInto');
    const { craft } = make();
    craft.update(NOV_4, planets, camera(7e8), viewport, null, null);
    const first = spy.mock.calls.length;
    craft.update(NOV_4, planets, camera(7e8), viewport, null, null);
    const second = spy.mock.calls.length - first;
    // at most one state per spacecraft (its dot, which is also its trail's end), never a 181-point resample
    expect(second).toBeLessThanOrEqual(2 * SPACECRAFT.length);
    craft.update(NOV_4 + 30 * 86_400_000, planets, camera(7e8), viewport, null, null);
    expect(spy.mock.calls.length - first - second).toBeGreaterThan(16 * 100);
    craft.dispose();
  });

  it("keeps a trail's last point on the spacecraft on a frame that does not resample", () => {
    load();
    const { craft } = make();
    const cam = camera(7e8);
    const i = at('voyager-1');
    craft.update(NOV_4, planets, cam, viewport, null, null);
    craft.update(NOV_4 + 1000, planets, cam, viewport, null, null); // 1 s
    const seg = dataOf(craft.trails[i]!, 'instanceStart');
    const sc = craft.scKm[i] as Vector3;
    const want = [sc.x - cam.position.x, sc.y - cam.position.y, sc.z - cam.position.z];
    for (let k = 0; k < 3; k++) expect(Math.abs(seg[seg.length - 3 + k]! - want[k]!)).toBeLessThan(Math.abs(want[k]!) * 1e-6 + 1); // float32
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
