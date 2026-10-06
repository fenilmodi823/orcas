import { describe, expect, it } from 'vitest';
import { IAU_POLES, iauPoleJ2000 } from '../src/iau-poles.js';

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
