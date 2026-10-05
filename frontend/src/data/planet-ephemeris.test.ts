import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import fixture from './fixtures/de421-planets.json' with { type: 'json' };
import {
  bodyPositionKm,
  EPHEMERIS_BODIES,
  parsePlanetEphemeris,
  PlanetEphemerisFormatError,
} from './planet-ephemeris.js';

type Vec = { x: number; y: number; z: number };
const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const toVec = ([x = NaN, y = NaN, z = NaN]: number[]): Vec => ({ x, y, z });
function angleArcsec(a: Vec, b: Vec): number {
  const cross = Math.hypot(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  const dot = a.x * b.x + a.y * b.y + a.z * b.z;
  return (Math.atan2(cross, dot) * 180 * 3600) / Math.PI;
}

// Vitest runs from frontend/ (see star-sky.test.ts for why not import.meta.url).
const file = readFileSync(resolve(process.cwd(), 'public/ephemeris/planets-de421.bin'));
const ephemeris = parsePlanetEphemeris(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
const EARTH = 399;
const positions = fixture.epochs[0]?.positionsKm as Record<string, number[]>;

describe('the baked DE421 planets (S3)', () => {
  it('carries the Sun, the eight planets and nothing else', () => {
    expect([...ephemeris.bodies.keys()].sort((a, b) => a - b)).toEqual(EPHEMERIS_BODIES.map((b) => b.naifId).sort((a, b) => a - b));
    expect(Object.keys(positions).map(Number).sort((a, b) => a - b)).toEqual([...ephemeris.bodies.keys()].sort((a, b) => a - b));
  });

  // S3's done-when asks for 1 arcminute (Cosmic-Scales-Brief §3.4); this holds
  // the bake to 1 arcsecond, as seen from the Earth, between keyframes and
  // near both ends of DE421's span.
  for (const epoch of fixture.epochs) {
    const utcMs = Date.parse(epoch.utc);
    const exact = epoch.positionsKm as Record<string, number[]>;
    const earthExact = toVec(exact[EARTH] ?? []);
    const earthBaked = bodyPositionKm(ephemeris, EARTH, utcMs);

    for (const body of EPHEMERIS_BODIES.filter((b) => b.naifId !== EARTH)) {
      it(`places ${body.name} within 1″ of DE421, seen from the Earth, at ${epoch.utc}`, () => {
        const baked = bodyPositionKm(ephemeris, body.naifId, utcMs);
        expect(baked).not.toBeNull();
        expect(earthBaked).not.toBeNull();
        const want = sub(toVec(exact[body.naifId] ?? []), earthExact);
        expect(angleArcsec(sub(baked!, earthBaked!), want)).toBeLessThan(1);
      });
    }
  }

  it('has no position outside the span it was baked over', () => {
    expect(bodyPositionKm(ephemeris, EARTH, Date.parse('1899-07-01T00:00:00Z'))).toBeNull();
    expect(bodyPositionKm(ephemeris, EARTH, Date.parse('2053-11-01T00:00:00Z'))).toBeNull();
  });

  it('has no position for a body it does not carry', () => {
    expect(bodyPositionKm(ephemeris, 301, Date.parse('2026-10-05T00:00:00Z'))).toBeNull();
  });

  it('rejects a file that is not a planet ephemeris', () => {
    expect(() => parsePlanetEphemeris(new TextEncoder().encode('ORCASKY1....').buffer)).toThrow(PlanetEphemerisFormatError);
  });
});
