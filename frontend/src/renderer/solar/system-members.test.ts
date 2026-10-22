import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { parseHorizonsEphemeris } from '../../data/horizons-ephemeris.js';
import { createHorizonsIndex } from '../../data/horizons-index.js';
import { resetMoonSystems } from '../../data/moon-systems.js';
import { parsePlanetEphemeris } from '../../data/planet-ephemeris.js';
import { bodyById, bodyPositionKm } from './bodies.js';
import { ECLIPTIC_NORTH_J2000 } from './body-target.js';
import { RING_OUTER_KM } from './saturn-rings.js';
import { systemMembers, systemPlaneNormal } from './system-members.js';

const read = (path: string) => {
  const f = readFileSync(resolve(process.cwd(), path));
  return f.buffer.slice(f.byteOffset, f.byteOffset + f.byteLength);
};
const planets = parsePlanetEphemeris(read('public/ephemeris/planets-de421.bin'));
const AT = Date.UTC(2026, 9, 12);
afterEach(() => resetMoonSystems());

describe("what a System view frames (S6b, NASA's `_goToSystem` children)", () => {
  it("is Jupiter and its four moons once they have loaded, offsets from Jupiter's centre", () => {
    const jupiter = bodyById('jupiter')!;
    resetMoonSystems({ jupiter: createHorizonsIndex(parseHorizonsEphemeris(read('public/ephemeris/horizons/moons-jupiter.bin'))) });
    const centre = bodyPositionKm(jupiter, AT, planets, new Vector3())!;
    const members = systemMembers(jupiter, AT, planets, centre);
    expect(members).toHaveLength(5);
    expect(members[0]?.radiusKm).toBe(71_492);
    const callisto = members.map((m) => m.offsetKm.length()).sort((a, b) => b - a)[0] ?? 0;
    expect(callisto).toBeGreaterThan(1.86e6);
    expect(callisto).toBeLessThan(1.9e6);
  });

  it("counts Saturn's rings, as NASA counts a RingsComponent", () => {
    const saturn = bodyById('saturn')!;
    expect(systemMembers(saturn, AT, planets, new Vector3())[0]?.radiusKm).toBe(RING_OUTER_KM);
  });

  it("looks down on the Earth's system from the Moon's orbit plane, about 5° off the ecliptic's", () => {
    const n = systemPlaneNormal(bodyById('earth')!, AT, new Vector3());
    expect(n.length()).toBeCloseTo(1, 9);
    const tilt = (n.angleTo(ECLIPTIC_NORTH_J2000) * 180) / Math.PI;
    expect(tilt).toBeGreaterThan(4.9);
    expect(tilt).toBeLessThan(5.4);
    expect(systemMembers(bodyById('earth')!, AT, planets, new Vector3())).toHaveLength(2); // the Earth and the Moon
  });
});
