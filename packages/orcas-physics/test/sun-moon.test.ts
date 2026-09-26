import { describe, expect, it } from 'vitest';
import fixture from './fixtures/de421-sun-moon.json' with { type: 'json' };
import {
  AU_KM,
  moonEclipticOfDate,
  moonPositionJ2000Km,
  sunDirectionJ2000,
  sunEclipticOfDate,
  sunPositionJ2000Km,
} from '../src/index.js';

type Vec = { x: number; y: number; z: number };
const norm = (v: Vec) => Math.hypot(v.x, v.y, v.z);
const toVec = ([x = NaN, y = NaN, z = NaN]: number[]): Vec => ({ x, y, z });
const normArr = (a: number[]) => norm(toVec(a));
/** Angle between an analytic vector and a DE421 one, degrees. */
function angleDeg(a: Vec, bArr: number[]): number {
  const b = toVec(bArr);
  const cos = (a.x * b.x + a.y * b.y + a.z * b.z) / (norm(a) * norm(b));
  return (Math.acos(Math.min(1, cos)) * 180) / Math.PI;
}
/** A Date for a Julian Ephemeris Day, so Meeus's TD examples are hit exactly. */
const fromJde = (jde: number) => new Date(((jde - 2440587.5) * 86_400 - 69.184) * 1000);

// Tolerances sit above the measured worst case (2026-09-27) with margin, and
// far inside what the scene needs: the Live-Sun-Moon plan asks for < 0.1° on
// the Moon and < 0.5° on the subsolar point.
//   measured worst: Moon 0.0127° / 22.3 km, Sun 0.0062° / 6994 km (4.7e-5)
describe('against JPL DE421, eight epochs 1992-2028', () => {
  for (const epoch of fixture.epochs) {
    const at = new Date(epoch.utc);
    it(`places the Moon within 0.03° and 40 km at ${epoch.utc}`, () => {
      const moon = moonPositionJ2000Km(at);
      expect(angleDeg(moon, epoch.moonKm)).toBeLessThan(0.03);
      expect(Math.abs(norm(moon) - normArr(epoch.moonKm))).toBeLessThan(40);
    });
    it(`points at the Sun within 0.01° at ${epoch.utc}`, () => {
      const sun = sunPositionJ2000Km(at);
      expect(angleDeg(sun, epoch.sunKm)).toBeLessThan(0.01);
      expect(Math.abs(norm(sun) / normArr(epoch.sunKm) - 1)).toBeLessThan(1e-4);
    });
  }
});

describe("Meeus's worked examples", () => {
  it('25.a — the Sun on 1992 Oct 13.0 TD', () => {
    const sun = sunEclipticOfDate(fromJde(2448908.5));
    expect(sun.trueLongitudeDeg).toBeCloseTo(199.90988, 4);
    expect(sun.distanceAu).toBeCloseTo(0.99766, 5);
  });

  // The full series gives these exactly; ours is truncated to its largest
  // terms, so it is held to what truncation costs, not to the printed digits.
  it('47.a — the Moon on 1992 Apr 12.0 TD', () => {
    const moon = moonEclipticOfDate(fromJde(2448724.5));
    expect(Math.abs(moon.longitudeDeg - 133.162655)).toBeLessThan(0.005);
    expect(Math.abs(moon.latitudeDeg - -3.229126)).toBeLessThan(0.01);
    expect(Math.abs(moon.distanceKm - 368409.7)).toBeLessThan(25);
  });
});

describe('sunDirectionJ2000', () => {
  it('is a unit vector', () => {
    expect(norm(sunDirectionJ2000(new Date('2026-09-26T00:00:00Z')))).toBeCloseTo(1, 12);
  });

  it('sits near the equinox point in late March, as the season requires', () => {
    // At the March equinox the Sun is at RA 0, Dec 0: +x in J2000.
    const d = sunDirectionJ2000(new Date('2026-03-20T14:46:00Z'));
    expect(d.x).toBeGreaterThan(0.9999);
  });

  it('is about 1 AU away', () => {
    expect(norm(sunPositionJ2000Km(new Date('2026-07-06T00:00:00Z'))) / AU_KM).toBeCloseTo(1.0167, 3);
  });
});
