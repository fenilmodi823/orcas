import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { horizonsStateKm, parseHorizonsEphemeris, type HorizonsEphemeris } from '../../data/horizons-ephemeris.js';
import { createHorizonsIndex } from '../../data/horizons-index.js';
import { resetMoonSystems } from '../../data/moon-systems.js';
import { bodyStateKm, parsePlanetEphemeris } from '../../data/planet-ephemeris.js';
import { applyPlanetCentre, horizonsGeocentricKm, planetCentreFromHorizons } from './system-centres.js';

const read = (path: string) => {
  const file = readFileSync(resolve(process.cwd(), path));
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
};
const planets = parsePlanetEphemeris(read('public/ephemeris/planets-de421.bin'));
const jupiterFile: HorizonsEphemeris = parseHorizonsEphemeris(read('public/ephemeris/horizons/moons-jupiter.bin'));
const marsFile: HorizonsEphemeris = parseHorizonsEphemeris(read('public/ephemeris/horizons/moons-mars.bin'));
const AT = Date.UTC(2026, 9, 12);

afterEach(() => resetMoonSystems());

function expectedGeocentric(file: HorizonsEphemeris, naifId: number, centre: number, at: number): Vector3 {
  const rel = horizonsStateKm(file, naifId, at);
  const c = bodyStateKm(planets, centre, at);
  const earth = bodyStateKm(planets, 399, at);
  if (!rel || !c || !earth) throw new Error('fixture has no data');
  return new Vector3(c.position.x - earth.position.x + rel.position.x, c.position.y - earth.position.y + rel.position.y, c.position.z - earth.position.z + rel.position.z);
}

describe("a system's centres (S6b)", () => {
  it("places a moon at DE421's centre plus the export's offset", () => {
    resetMoonSystems({ jupiter: createHorizonsIndex(jupiterFile), mars: createHorizonsIndex(marsFile) });
    const io = horizonsGeocentricKm('jupiter', 501, AT, planets, new Vector3());
    expect(io?.distanceTo(expectedGeocentric(jupiterFile, 501, 5, AT))).toBeLessThan(1e-3);
    const phobos = horizonsGeocentricKm('mars', 401, AT, planets, new Vector3());
    expect(phobos?.distanceTo(expectedGeocentric(marsFile, 401, 499, AT))).toBeLessThan(1e-3); // Mars's moons hang from Mars itself
  });

  it('has no moon before its system loads, before DE421 loads, or outside the export', () => {
    expect(horizonsGeocentricKm('jupiter', 501, AT, planets, new Vector3())).toBeNull();
    resetMoonSystems({ jupiter: createHorizonsIndex(jupiterFile) });
    expect(horizonsGeocentricKm('jupiter', 501, AT, null, new Vector3())).toBeNull();
    expect(horizonsGeocentricKm('jupiter', 501, Date.UTC(1990, 0, 1), planets, new Vector3())).toBeNull();
  });

  it('moves Jupiter from its barycentre to its centre, at most 220 km, once its moons have loaded', () => {
    const v = new Vector3(1, 2, 3);
    expect(applyPlanetCentre(599, AT, v)).toBe(false);
    expect(v.toArray()).toEqual([1, 2, 3]);
    expect(planetCentreFromHorizons(599, AT)).toBe(false);
    resetMoonSystems({ jupiter: createHorizonsIndex(jupiterFile) });
    expect(applyPlanetCentre(599, AT, v)).toBe(true);
    const moved = v.distanceTo(new Vector3(1, 2, 3));
    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeLessThanOrEqual(221); // 1 to 220 km across the export
    expect(planetCentreFromHorizons(599, AT)).toBe(true);
  });

  it('leaves Mars (DE421 has its centre), the Earth and the Sun alone', () => {
    resetMoonSystems({ mars: createHorizonsIndex(marsFile) });
    for (const id of [499, 399, 10]) {
      const v = new Vector3(1, 2, 3);
      expect(applyPlanetCentre(id, AT, v)).toBe(false);
      expect(v.toArray()).toEqual([1, 2, 3]);
    }
  });
});
