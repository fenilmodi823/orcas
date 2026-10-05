import type { EciVec3 } from 'satellite.js';
import { moonPositionJ2000Km } from './moon.js';
import { sunPositionJ2000Km } from './sun.js';

type Vec = EciVec3<number>;

export interface LagrangePoints {
  readonly L1: Vec;
  readonly L2: Vec;
  readonly L3: Vec;
  readonly L4: Vec;
  readonly L5: Vec;
}

// GM, km^3 s^-2, JPL planetary ephemeris DE440 (JPL SSD "Astrodynamic
// Parameters", https://ssd.jpl.nasa.gov/astro_par.html). Mass ratios are GM ratios.
export const GM_SUN = 132_712_440_041.279419;
const GM_EARTH = 398_600.435507;
const GM_MOON = 4_902.800118;

/** CRTBP mass parameter m2 / (m1 + m2), Earth–Moon. Unitless. */
export const EARTH_MOON_MU = GM_MOON / (GM_EARTH + GM_MOON);
/** CRTBP mass parameter for the Sun and the Earth–Moon barycentre. Unitless. */
export const SUN_EARTH_MU = (GM_EARTH + GM_MOON) / (GM_SUN + GM_EARTH + GM_MOON);

/** Half-width of the central difference that gives the secondary's direction of motion. */
const VELOCITY_HALF_STEP_MS = 60_000;
const SIN_60 = Math.sqrt(3) / 2;

/** Newton's method on the axial force balance, from `seed`. Normalised CRTBP units. */
function solveCollinear(seed: number, mu: number): number {
  let x = seed;
  for (let i = 0; i < 50; i++) {
    const a = x + mu;
    const b = x - 1 + mu;
    const ra3 = Math.abs(a) ** 3;
    const rb3 = Math.abs(b) ** 3;
    const f = x - ((1 - mu) * a) / ra3 - (mu * b) / rb3;
    const df = 1 + (2 * (1 - mu)) / ra3 + (2 * mu) / rb3;
    const step = f / df;
    x -= step;
    if (Math.abs(step) < 1e-15) break;
  }
  return x;
}

/**
 * The collinear points of the circular restricted three-body problem, as
 * positions on the axis of the rotating frame: barycentre at 0, primary at
 * −μ, secondary at 1 − μ, unit separation. Each is the root of the axial
 * force balance, Newton-solved from the first-order Hill-radius seed
 * (RA-5 §2.2). Input: μ, unitless. Output: unitless.
 */
export function collinearLagrangeX(mu: number): { l1: number; l2: number; l3: number } {
  const hill = Math.cbrt(mu / 3);
  return {
    l1: solveCollinear(1 - mu - hill, mu),
    l2: solveCollinear(1 - mu + hill, mu),
    l3: solveCollinear(-1 - (5 * mu) / 12, mu),
  };
}

/**
 * L1–L5 for a primary and secondary at their instantaneous separation: the
 * circular model applied to the real geometry of the moment (RA5.D2). L4
 * leads the secondary by 60° in its orbital plane, L5 trails it. Input:
 * positions in km, any one frame; the secondary's velocity relative to the
 * primary, any units (only its direction is used). Output: km, same frame.
 */
export function lagrangePointsKm(primaryKm: Vec, secondaryKm: Vec, secondaryVelocity: Vec, mu: number): LagrangePoints {
  const dx = secondaryKm.x - primaryKm.x;
  const dy = secondaryKm.y - primaryKm.y;
  const dz = secondaryKm.z - primaryKm.z;
  const r = Math.hypot(dx, dy, dz);
  const rx = dx / r;
  const ry = dy / r;
  const rz = dz / r;
  // The part of the velocity perpendicular to the axis: the direction of motion.
  const along = secondaryVelocity.x * rx + secondaryVelocity.y * ry + secondaryVelocity.z * rz;
  let tx = secondaryVelocity.x - along * rx;
  let ty = secondaryVelocity.y - along * ry;
  let tz = secondaryVelocity.z - along * rz;
  const t = Math.hypot(tx, ty, tz);
  tx /= t;
  ty /= t;
  tz /= t;

  const at = (u: number, w: number): Vec => ({
    x: primaryKm.x + r * (u * rx + w * tx),
    y: primaryKm.y + r * (u * ry + w * ty),
    z: primaryKm.z + r * (u * rz + w * tz),
  });
  const { l1, l2, l3 } = collinearLagrangeX(mu);
  // Collinear positions are barycentric; + μ makes them relative to the primary.
  return { L1: at(l1 + mu, 0), L2: at(l2 + mu, 0), L3: at(l3 + mu, 0), L4: at(0.5, SIN_60), L5: at(0.5, -SIN_60) };
}

function difference(later: Vec, earlier: Vec): Vec {
  return { x: later.x - earlier.x, y: later.y - earlier.y, z: later.z - earlier.z };
}

/** Earth–Moon L1–L5 from the M1.11 Moon. Modelled, not observed. Input: UTC Date. Output: km, J2000, geocentric. */
export function earthMoonLagrangeJ2000Km(at: Date): LagrangePoints {
  const ms = at.getTime();
  const velocity = difference(
    moonPositionJ2000Km(new Date(ms + VELOCITY_HALF_STEP_MS)),
    moonPositionJ2000Km(new Date(ms - VELOCITY_HALF_STEP_MS)),
  );
  return lagrangePointsKm({ x: 0, y: 0, z: 0 }, moonPositionJ2000Km(at), velocity, EARTH_MOON_MU);
}

/** The Earth–Moon barycentre's position relative to the Sun. Input: UTC ms. Output: km, J2000. */
function barycentreFromSunKm(ms: number): Vec {
  const at = new Date(ms);
  const moon = moonPositionJ2000Km(at);
  const sun = sunPositionJ2000Km(at);
  const k = EARTH_MOON_MU;
  return { x: k * moon.x - sun.x, y: k * moon.y - sun.y, z: k * moon.z - sun.z };
}

/**
 * Sun–Earth L1–L5 from the M1.11 Sun and Moon, the secondary being the
 * Earth–Moon barycentre, as is conventional. Modelled, not observed.
 * Input: UTC Date. Output: km, J2000, geocentric.
 */
export function sunEarthLagrangeJ2000Km(at: Date): LagrangePoints {
  const ms = at.getTime();
  const sun = sunPositionJ2000Km(at);
  const moon = moonPositionJ2000Km(at);
  const k = EARTH_MOON_MU;
  const barycentre = { x: k * moon.x, y: k * moon.y, z: k * moon.z };
  const velocity = difference(barycentreFromSunKm(ms + VELOCITY_HALF_STEP_MS), barycentreFromSunKm(ms - VELOCITY_HALF_STEP_MS));
  return lagrangePointsKm(sun, barycentre, velocity, SUN_EARTH_MU);
}
