import type { EciVec3 } from 'satellite.js';
import { WGS84_A_KM } from './coordinates.js';

/** Nominal solar radius, km (IAU 2015 Resolution B3). */
export const SUN_RADIUS_KM = 695_700;

const clampUnit = (v: number): number => Math.min(1, Math.max(-1, v));

/**
 * Fraction of the Sun's disk visible from a point near the Earth: 1 in
 * sunlight, 0 in the umbra, in between in the penumbra. The conical shadow
 * model — Sun and Earth as spheres (Montenbruck & Gill, *Satellite Orbits*,
 * 2000, §3.4.2). The Earth is a sphere of the WGS84 equatorial radius;
 * oblateness and atmospheric refraction are ignored.
 *
 * Input: geocentric positions of the point and of the Sun, km, in the same
 * inertial frame (the scene uses J2000). Output: dimensionless, [0, 1].
 * A point inside the Earth returns 0.
 */
export function sunlitFraction(pointKm: EciVec3<number>, sunKm: EciVec3<number>): number {
  const { x: rx, y: ry, z: rz } = pointKm;
  const sx = sunKm.x - rx; // point -> Sun
  const sy = sunKm.y - ry;
  const sz = sunKm.z - rz;
  const rNorm = Math.hypot(rx, ry, rz);
  const sNorm = Math.hypot(sx, sy, sz);
  if (rNorm <= WGS84_A_KM) return 0;
  const a = Math.asin(Math.min(1, SUN_RADIUS_KM / sNorm)); // apparent solar radius
  const b = Math.asin(WGS84_A_KM / rNorm); // apparent Earth radius
  // Angle between the directions point -> Earth centre (-r) and point -> Sun.
  const c = Math.acos(clampUnit(-(rx * sx + ry * sy + rz * sz) / (rNorm * sNorm)));
  return visibleDiskFraction(a, b, c);
}

/**
 * Fraction of a disk of angular radius `a` (the Sun) left uncovered by a disk
 * of angular radius `b` (the Earth) whose centre is `c` away — the flat-disk
 * overlap of the conical model. Inputs: radians. Output: dimensionless, [0, 1].
 */
export function visibleDiskFraction(a: number, b: number, c: number): number {
  if (c >= a + b) return 1; // no overlap
  if (c <= b - a) return 0; // the Sun is wholly behind the Earth: umbra
  if (c <= a - b) return 1 - (b * b) / (a * a); // the Earth wholly inside the Sun's disk
  const x = (c * c + a * a - b * b) / (2 * c);
  const y = Math.sqrt(Math.max(0, a * a - x * x));
  const overlap = a * a * Math.acos(clampUnit(x / a)) + b * b * Math.acos(clampUnit((c - x) / b)) - c * y;
  return Math.min(1, Math.max(0, 1 - overlap / (Math.PI * a * a)));
}
