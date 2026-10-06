import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { iauPoleJ2000 } from '@orcas/physics';
import { bodyStateKm, parsePlanetEphemeris } from '../../data/planet-ephemeris.js';

// Vitest runs from frontend/ (see star-sky.test.ts for why not import.meta.url).
const file = readFileSync(resolve(process.cwd(), 'public/ephemeris/planets-de421.bin'));
const ephemeris = parsePlanetEphemeris(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
const J2000_MS = Date.UTC(2000, 0, 1, 11, 58, 55, 816);

/**
 * Axial tilt to the orbit, degrees: NASA NSSDC Planetary Fact Sheet, as reproduced in Wikipedia's "Axial
 * tilt" table on 2026-10-06 (nssdc.gsfc.nasa.gov refused connections that day). IAU convention, so Venus
 * and Uranus read under 90°. Measured 2026-10-06: every planet within 0.011°. Without Mars's long-period
 * term Mars read 23.916°, which is why that term is in iau-poles.ts.
 */
const CASES = [
  { name: 'Mercury', pole: 199, orbit: 199, tiltDeg: 0.03 },
  { name: 'Venus', pole: 299, orbit: 299, tiltDeg: 2.64 },
  { name: 'Earth', pole: 399, orbit: 399, tiltDeg: 23.44 },
  { name: 'Mars', pole: 499, orbit: 499, tiltDeg: 25.19 },
  { name: 'Jupiter', pole: 599, orbit: 5, tiltDeg: 3.13 },
  { name: 'Saturn', pole: 699, orbit: 6, tiltDeg: 26.73 },
  { name: 'Uranus', pole: 799, orbit: 7, tiltDeg: 82.23 },
  { name: 'Neptune', pole: 899, orbit: 8, tiltDeg: 28.32 },
];

describe('IAU poles against DE421 orbits', () => {
  // Two independent sources: the poles from NAIF's IAU 2015 kernel, the orbit normal r × v from the DE421 bake.
  it.each(CASES)('tilts $name’s pole $tiltDeg° from its orbit', ({ pole, orbit, tiltDeg }) => {
    const sun = bodyStateKm(ephemeris, 10, J2000_MS);
    const body = bodyStateKm(ephemeris, orbit, J2000_MS);
    const p = iauPoleJ2000(pole, new Date(J2000_MS));
    if (!sun || !body || !p) throw new Error('missing data');
    const r = { x: body.position.x - sun.position.x, y: body.position.y - sun.position.y, z: body.position.z - sun.position.z };
    const v = { x: body.velocity.x - sun.velocity.x, y: body.velocity.y - sun.velocity.y, z: body.velocity.z - sun.velocity.z };
    const n = { x: r.y * v.z - r.z * v.y, y: r.z * v.x - r.x * v.z, z: r.x * v.y - r.y * v.x };
    const cos = (n.x * p.x + n.y * p.y + n.z * p.z) / Math.hypot(n.x, n.y, n.z);
    const tilt = (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
    expect(Math.abs(tilt - tiltDeg)).toBeLessThanOrEqual(0.05);
  });
});
