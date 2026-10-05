import { describe, expect, it } from 'vitest';
import {
  collinearLagrangeX,
  EARTH_MOON_MU,
  earthMoonLagrangeJ2000Km,
  lagrangePointsKm,
  moonPositionJ2000Km,
  SUN_EARTH_MU,
  sunDirectionJ2000,
  sunEarthLagrangeJ2000Km,
} from '../src/index.js';

type Vec = { x: number; y: number; z: number };
const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = (v: Vec) => Math.hypot(v.x, v.y, v.z);
const angleDeg = (a: Vec, b: Vec) => (Math.acos(Math.min(1, dot(a, b) / (norm(a) * norm(b)))) * 180) / Math.PI;

/** Net force along the axis in the rotating frame, normalised CRTBP units. Zero at L1-L3. */
function axialForce(x: number, mu: number): number {
  const a = x + mu;
  const b = x - 1 + mu;
  return x - ((1 - mu) * a) / Math.abs(a) ** 3 - (mu * b) / Math.abs(b) ** 3;
}

describe('collinear points of the circular restricted three-body problem', () => {
  // Published barycentric positions for the Earth-Moon system: L1 0.837,
  // L2 1.156, L3 -1.005 lunar units (Evans, AMOS 2024,
  // https://amostech.com/TechnicalPapers/2024/Poster/Evans.pdf).
  it('reproduces the published Earth-Moon positions', () => {
    const { l1, l2, l3 } = collinearLagrangeX(EARTH_MOON_MU);
    expect(l1).toBeCloseTo(0.837, 3);
    expect(l2).toBeCloseTo(1.156, 3);
    expect(l3).toBeCloseTo(-1.005, 3);
  });

  for (const [system, mu] of [
    ['Sun-Earth', SUN_EARTH_MU],
    ['Earth-Moon', EARTH_MOON_MU],
  ] as const) {
    it(`balances the forces exactly at each ${system} point`, () => {
      for (const x of Object.values(collinearLagrangeX(mu))) expect(Math.abs(axialForce(x, mu))).toBeLessThan(1e-12);
    });
  }
});

describe('lagrangePointsKm', () => {
  const primary = { x: 100, y: -50, z: 20 };
  const secondary = { x: 100 + 384_400, y: -50, z: 20 };
  const velocity = { x: 0, y: 1, z: 0 }; // the secondary moves along +y
  const points = lagrangePointsKm(primary, secondary, velocity, EARTH_MOON_MU);

  it('puts L4 and L5 at the separation from both bodies', () => {
    for (const p of [points.L4, points.L5]) {
      expect(norm(sub(p, primary))).toBeCloseTo(384_400, 6);
      expect(norm(sub(p, secondary))).toBeCloseTo(384_400, 6);
    }
  });

  it('puts L4 ahead of the secondary in its motion and L5 behind', () => {
    expect(dot(sub(points.L4, secondary), velocity)).toBeGreaterThan(0);
    expect(dot(sub(points.L5, secondary), velocity)).toBeLessThan(0);
  });

  it('puts L1, L2 and L3 on the line through both bodies, in order', () => {
    for (const p of [points.L1, points.L2, points.L3]) expect(Math.hypot(p.y + 50, p.z - 20)).toBeLessThan(1e-6);
    expect(points.L3.x).toBeLessThan(primary.x);
    expect(points.L1.x).toBeGreaterThan(primary.x);
    expect(points.L1.x).toBeLessThan(secondary.x);
    expect(points.L2.x).toBeGreaterThan(secondary.x);
  });
});

describe('the scene positions, from the M1.11 Sun and Moon', () => {
  const epochs = ['2026-01-03T12:00:00Z', '2026-07-04T00:00:00Z', '2026-10-05T08:00:00Z'];

  for (const iso of epochs) {
    const at = new Date(iso);

    // STScI's JWST documentation: L2 is "about 1.5 million km from Earth in
    // the anti-Sun direction" (RA-5 §2.1). The range covers perihelion to
    // aphelion; the angle allows for the barycentre, up to ~4,700 km off
    // Earth's centre, being the secondary body.
    it(`puts Sun-Earth L2 about 1.5 million km anti-sunward at ${iso}`, () => {
      const { L2 } = sunEarthLagrangeJ2000Km(at);
      const s = sunDirectionJ2000(at);
      expect(norm(L2)).toBeGreaterThan(1.47e6);
      expect(norm(L2)).toBeLessThan(1.54e6);
      expect(angleDeg(L2, { x: -s.x, y: -s.y, z: -s.z })).toBeLessThan(0.25);
    });

    it(`puts Earth-Moon L1 on the line to the Moon, at its CRTBP fraction, at ${iso}`, () => {
      const { L1 } = earthMoonLagrangeJ2000Km(at);
      const moon = moonPositionJ2000Km(at);
      expect(angleDeg(L1, moon)).toBeLessThan(1e-5); // acos resolution near 0
      expect(norm(L1) / norm(moon)).toBeCloseTo(collinearLagrangeX(EARTH_MOON_MU).l1 + EARTH_MOON_MU, 9);
    });
  }
});
