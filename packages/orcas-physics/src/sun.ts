import type { EciVec3 } from 'satellite.js';
import { eclipticOfDateToJ2000Km, julianCenturiesTTFromUtc, wrapDeg } from './ecliptic.js';

const DEG = Math.PI / 180;
export const AU_KM = 149_597_870.7;

/**
 * Geometric geocentric position of the Sun, from Meeus, *Astronomical
 * Algorithms* (2nd ed.) ch. 25, "low accuracy": ~0.01° in longitude. Neither
 * aberration (20.5″) nor nutation is applied — this is where the Sun *is*,
 * which is what lights the scene, not where it appears. Latitude is taken as
 * 0 (the true value never exceeds 1.2″). Input: UTC Date. Output: km, J2000.
 */
export function sunPositionJ2000Km(at: Date): EciVec3<number> {
  const { trueLongitudeDeg, distanceAu } = sunEclipticOfDate(at);
  return eclipticOfDateToJ2000Km(trueLongitudeDeg, 0, distanceAu * AU_KM, at);
}

/** The same Sun as true longitude (mean equinox of date) and distance. Input: UTC Date. Output: degrees, AU. */
export function sunEclipticOfDate(at: Date): { trueLongitudeDeg: number; distanceAu: number } {
  const t = julianCenturiesTTFromUtc(at);
  const l0 = 280.46646 + 36000.76983 * t + 0.0003032 * t * t;
  const m = 357.52911 + 35999.05029 * t - 0.0001537 * t * t;
  const e = 0.016708634 - 0.000042037 * t - 0.0000001267 * t * t;
  const mRad = m * DEG;
  const center =
    (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(mRad) +
    (0.019993 - 0.000101 * t) * Math.sin(2 * mRad) +
    0.000289 * Math.sin(3 * mRad);
  const trueLongitudeDeg = wrapDeg(l0 + center);
  const trueAnomalyRad = (m + center) * DEG;
  const distanceAu = (1.000001018 * (1 - e * e)) / (1 + e * Math.cos(trueAnomalyRad));
  return { trueLongitudeDeg, distanceAu };
}

/** Unit vector from Earth's centre toward the Sun. Input: UTC Date. Output: J2000, unitless. */
export function sunDirectionJ2000(at: Date): EciVec3<number> {
  const p = sunPositionJ2000Km(at);
  const n = Math.hypot(p.x, p.y, p.z);
  return { x: p.x / n, y: p.y / n, z: p.z / n };
}
