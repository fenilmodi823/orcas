import { describe, expect, it } from 'vitest';
import { IAU_POLES, IAU_PRIME_MERIDIANS, iauBodyAxesJ2000, iauPoleJ2000 } from '../src/iau-poles.js';

const J2000 = new Date(Date.UTC(2000, 0, 1, 11, 58, 55, 816)); // 2000-01-01 12:00 TT
const DEG = Math.PI / 180;
const angleDeg = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
  Math.acos(Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z)) / DEG;

// The ecliptic's north pole in J2000 equatorial axes; obliquity at J2000, IAU 2006: 84381.406″.
const EPS = (84381.406 / 3600) * DEG;
const ECLIPTIC_NORTH = { x: 0, y: -Math.sin(EPS), z: Math.cos(EPS) };

describe('iauPoleJ2000', () => {
  it('puts the Earth’s pole at J2000 on the frame’s +z axis', () => {
    const p = iauPoleJ2000(399, J2000);
    expect(p?.x).toBeCloseTo(0, 6);
    expect(p?.y).toBeCloseTo(0, 6);
    expect(p?.z).toBeCloseTo(1, 12);
  });

  it('returns a unit vector for every body it carries', () => {
    for (const id of Object.keys(IAU_POLES).map(Number)) {
      const p = iauPoleJ2000(id, new Date(Date.UTC(2026, 9, 6)));
      expect(p).not.toBeNull();
      if (p) expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(1, 12);
    }
  });

  it('returns null for a body it does not carry', () => {
    expect(iauPoleJ2000(5, J2000)).toBeNull(); // Jupiter's system barycentre has no pole
  });

  // An independent check: the Sun's equator is inclined 7.25° to the ecliptic (NASA NSSDC Sun Fact
  // Sheet, Carrington's value). The IAU pole was transcribed from NAIF pck00011, a different source.
  it('tilts the Sun’s pole 7.25° from the ecliptic’s', () => {
    const p = iauPoleJ2000(10, J2000);
    expect(p).not.toBeNull();
    if (p) expect(angleDeg(p, ECLIPTIC_NORTH)).toBeCloseTo(7.25, 1);
  });

  it('moves the Earth’s pole by the IAU precession rates', () => {
    // A century on, α = −0.641°, δ = 90 − 0.557° (pck00011 BODY399_POLE_RA/DEC).
    const p = iauPoleJ2000(399, new Date(Date.UTC(2100, 0, 1, 11, 58, 55, 816)));
    expect(p).not.toBeNull();
    if (p) expect(angleDeg(p, { x: 0, y: 0, z: 1 })).toBeCloseTo(0.557, 3);
  });
});

const dot = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => a.x * b.x + a.y * b.y + a.z * b.z;

describe('iauBodyAxesJ2000', () => {
  const at = new Date(Date.UTC(2026, 9, 6, 12));

  it('builds a right-handed orthonormal frame whose z is the IAU pole', () => {
    for (const id of Object.keys(IAU_PRIME_MERIDIANS).map(Number)) {
      const axes = iauBodyAxesJ2000(id, at);
      const pole = iauPoleJ2000(id, at);
      if (!axes || !pole) throw new Error(`no frame for ${id}`);
      const { x, y, z } = axes;
      for (const v of [x, y, z]) expect(Math.hypot(v.x, v.y, v.z)).toBeCloseTo(1, 12);
      expect(dot(x, y)).toBeCloseTo(0, 12);
      expect(dot(x, z)).toBeCloseTo(0, 12);
      expect(dot(z, pole)).toBeCloseTo(1, 12);
      expect(x.y * y.z - x.z * y.y).toBeCloseTo(z.x, 12); // (x × y)ₓ = zₓ
    }
  });

  it('puts the prime meridian W₀ east of the node at J2000', () => {
    // At t = 0 Jupiter's x is W₀ = 284.95° from the node at α₀ + 90° (pck00011 BODY599_PM). t = 0 is the code's
    // own: it takes TT − UTC as today's 69.184 s, 5 s more than in 2000, and Jupiter turns 0.05° in 5 s.
    const axes = iauBodyAxesJ2000(599, new Date(Date.UTC(2000, 0, 1, 11, 58, 50, 816)));
    const p = IAU_POLES[599];
    if (!axes || !p) throw new Error('no frame');
    const node = { x: -Math.sin(p.ra0Deg * DEG), y: Math.cos(p.ra0Deg * DEG), z: 0 };
    expect(Math.acos(dot(axes.x, node)) / DEG).toBeCloseTo(360 - 284.95, 6);
  });

  it('turns prograde bodies east and Venus and Uranus west', () => {
    for (const [id, sign] of [[499, 1], [599, 1], [299, -1], [799, -1]] as const) {
      const a = iauBodyAxesJ2000(id, at);
      const b = iauBodyAxesJ2000(id, new Date(at.getTime() + 60_000));
      if (!a || !b) throw new Error('no frame');
      expect(Math.sign(dot(b.x, a.y))).toBe(sign);
    }
  });

  it('returns null without a prime meridian', () => {
    expect(iauBodyAxesJ2000(399, J2000)).toBeNull(); // the Earth turns by GMST in the scene
    expect(iauBodyAxesJ2000(5, J2000)).toBeNull();
  });
});

describe('IAU_PRIME_MERIDIANS rates', () => {
  /**
   * An independent source for Ẇ: sidereal rotation periods in days, Allen's Astrophysical Quantities (2000) p. 296,
   * as tabulated by Wikipedia's "Rotation period (astronomy)" on 2026-10-06. Three bodies are left out because IAU 2015
   * revised them after Allen: Venus (243.0185 d, Magellan), Saturn (Allen gives a deep-interior period, not System III)
   * and Neptune (Karkoschka 2011's 15.9663 h, where Allen has Voyager's 16.11 h).
   */
  const PERIODS_D = [
    { id: 10, name: 'Sun', days: 25.379995 },
    { id: 199, name: 'Mercury', days: 58.6462 },
    { id: 499, name: 'Mars', days: 1.02595675 },
    { id: 599, name: 'Jupiter', days: 0.41354 },
    { id: 799, name: 'Uranus', days: 0.71833 },
  ];

  it.each(PERIODS_D)('turns $name once in $days days', ({ id, days }) => {
    const m = IAU_PRIME_MERIDIANS[id];
    if (!m) throw new Error('missing');
    expect(Math.abs(360 / Math.abs(m.wDegPerDay) - days) / days).toBeLessThan(2e-5);
  });
});

describe("the major moons' poles (S6b, pck00011, every term)", () => {
  const at = new Date(Date.UTC(2026, 9, 12));
  const raDecDeg = (naifId: number) => {
    const p = iauPoleJ2000(naifId, at);
    if (!p) throw new Error(`no pole for ${naifId}`);
    const ra = (Math.atan2(p.y, p.x) * 180) / Math.PI;
    return { ra: ra < 0 ? ra + 360 : ra, dec: (Math.asin(p.z) * 180) / Math.PI };
  };

  // Computed from pck00011.tpc by script on 2026-10-12, Mars's angles read as triples (BODY4_MAX_PHASE_DEGREE = 2).
  it.each([
    [401, 316.306684, 53.595811], // Phobos
    [402, 314.022499, 54.439871], // Deimos
    [501, 268.087395, 64.476694], // Io
    [601, 52.134714, 84.33244], // Mimas
    [705, 253.103542, -14.309121], // Miranda
    [801, 304.342873, 20.664529], // Triton: its first term alone is 2.21° out
  ])('NAIF %i points where pck00011 puts it on 2026-10-12', (naifId, ra, dec) => {
    const got = raDecDeg(naifId);
    expect(got.ra).toBeCloseTo(ra, 5);
    expect(got.dec).toBeCloseTo(dec, 5);
  });

  it('covers all 19 major moons, each with a body frame (S6b2)', () => {
    const ids = [401, 402, 501, 502, 503, 504, 601, 602, 603, 604, 605, 606, 608, 701, 702, 703, 704, 705, 801];
    expect(ids.every((id) => IAU_POLES[id] !== undefined)).toBe(true);
    expect(ids.every((id) => iauBodyAxesJ2000(id, at) !== null)).toBe(true);
  });
});

describe("the major moons' prime meridians (S6b2, pck00011, every term)", () => {
  /** W, degrees: the angle from the equator's ascending node (α₀ + 90°) east to the body's x axis. */
  const primeMeridianDeg = (naifId: number, at: Date) => {
    const axes = iauBodyAxesJ2000(naifId, at);
    const p = iauPoleJ2000(naifId, at);
    if (!axes || !p) throw new Error(`no frame for ${naifId}`);
    const ra = Math.atan2(p.y, p.x);
    const sd = p.z;
    const cd = Math.hypot(p.x, p.y);
    const node = { x: -Math.sin(ra), y: Math.cos(ra), z: 0 };
    const north = { x: -sd * Math.cos(ra), y: -sd * Math.sin(ra), z: cd };
    const w = Math.atan2(dot(axes.x, north), dot(axes.x, node)) / DEG;
    return w < 0 ? w + 360 : w;
  };

  // From pck00011.tpc by Python on 2026-10-22 (scripts/data/gen_moon_rotation.py's reader), on the code's time
  // scale, TT = UTC + 69.184 s: W₀ + Ẇd + Ẅd² + Σ a sin(θ₀ + θ₁T + θ₂T²), Mars's angles read as triples.
  it.each([
    [401, 223.109531], // Phobos: a quadratic W and a quadratic libration angle
    [501, 344.229801], // Io
    [601, 295.271723], // Mimas: a 44.85° term
    [608, 98.694028], // Iapetus
    [705, 227.053835], // Miranda: turns west
    [801, 207.124348], // Triton: turns west, nine terms
  ])('NAIF %i faces where pck00011 puts it on 2026-10-12', (naifId, w) => {
    expect(primeMeridianDeg(naifId, new Date(Date.UTC(2026, 9, 12)))).toBeCloseTo(w, 4);
  });
});
