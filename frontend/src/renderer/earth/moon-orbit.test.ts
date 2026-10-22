import { describe, expect, it } from 'vitest';
import { moonPositionJ2000Km } from '@orcas/physics';
import { ORBIT_SAMPLES } from '../solar/orbit-line.js';
import { ECLIPTIC_NORTH_J2000 } from '../solar/body-target.js';
import { writeMoonOrbit } from './moon-orbit.js';

const AT = Date.UTC(2026, 9, 12);
const ellipse = new Float64Array(ORBIT_SAMPLES * 3);
const point = (k: number) => [ellipse[k * 3] ?? NaN, ellipse[k * 3 + 1] ?? NaN, ellipse[k * 3 + 2] ?? NaN] as const;

describe("the Moon's orbit line (S6b, NASA's OrbitLineComponent)", () => {
  it('starts and ends at the Moon', () => {
    expect(writeMoonOrbit(AT, ellipse)).toBe(true);
    const m = moonPositionJ2000Km(new Date(AT));
    for (const k of [0, ORBIT_SAMPLES - 1]) {
      const [x, y, z] = point(k);
      expect(Math.hypot(x - m.x, y - m.y, z - m.z)).toBeLessThan(1);
    }
  });

  it('stays at lunar distance, in a plane about 5° from the ecliptic', () => {
    writeMoonOrbit(AT, ellipse);
    for (let k = 0; k < ORBIT_SAMPLES; k++) {
      const r = Math.hypot(...point(k));
      expect(r).toBeGreaterThan(340_000);
      expect(r).toBeLessThan(420_000);
    }
    const [ax, ay, az] = point(0);
    const [bx, by, bz] = point(90); // a quarter of the way round
    const n = [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
    const cos = ((n[0] ?? 0) * ECLIPTIC_NORTH_J2000.x + (n[1] ?? 0) * ECLIPTIC_NORTH_J2000.y + (n[2] ?? 0) * ECLIPTIC_NORTH_J2000.z) / Math.hypot(n[0] ?? 0, n[1] ?? 0, n[2] ?? 0);
    const tiltDeg = (Math.acos(cos) * 180) / Math.PI;
    expect(tiltDeg).toBeGreaterThan(4.9);
    expect(tiltDeg).toBeLessThan(5.4);
  });
});
