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
import { spacecraftSystemBody, systemMembers, systemPlaneNormal } from './system-members.js';

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

describe('a spacecraft in a System view (S6c1)', () => {
  const craftIndex = () => createHorizonsIndex(parseHorizonsEphemeris(read('public/ephemeris/horizons/spacecraft.bin')));
  const NOV_4 = Date.UTC(2026, 10, 4);

  it('adds a radius-0 member at the spacecraft, from the centre', () => {
    const jupiter = bodyById('jupiter')!;
    const centre = bodyPositionKm(jupiter, NOV_4, planets, new Vector3())!;
    const extra = centre.clone().add(new Vector3(5e6, 0, 0));
    const members = systemMembers(jupiter, NOV_4, planets, centre, extra);
    const last = members.at(-1)!;
    expect(last.radiusKm).toBe(0);
    expect(last.offsetKm.x).toBeCloseTo(5e6, 3);
  });

  it('names the body each spacecraft is near now, from CENTRE_BODY', () => {
    resetMoonSystems({ spacecraft: craftIndex() });
    expect(spacecraftSystemBody(bodyById('juno')!, NOV_4)?.id).toBe('jupiter');
    expect(spacecraftSystemBody(bodyById('voyager-1')!, NOV_4)?.id).toBe('sun');
    expect(spacecraftSystemBody(bodyById('lro')!, NOV_4)?.id).toBe('moon');
    expect(spacecraftSystemBody(bodyById('juno')!, Date.UTC(1900, 0, 1))).toBeNull();
    expect(spacecraftSystemBody(bodyById('io')!, NOV_4)).toBeNull();
  });
});
