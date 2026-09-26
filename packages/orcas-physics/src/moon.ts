import type { EciVec3 } from 'satellite.js';
import { eclipticOfDateToJ2000Km, julianCenturiesTTFromUtc, wrapDeg } from './ecliptic.js';
import { MOON_DISTANCE_TERMS, MOON_LATITUDE_TERMS, MOON_LONGITUDE_TERMS, type MoonTerm } from './moon-terms.js';

const DEG = Math.PI / 180;
export const MOON_RADIUS_KM = 1737.4;

interface Arguments {
  readonly d: number; // mean elongation, rad
  readonly m: number; // Sun's mean anomaly, rad
  readonly mp: number; // Moon's mean anomaly, rad
  readonly f: number; // argument of latitude, rad
  readonly e: number; // eccentricity factor, unitless
}

function sumTerms(terms: readonly MoonTerm[], a: Arguments, trig: (x: number) => number): number {
  let sum = 0;
  for (const [d, m, mp, f, coefficient] of terms) {
    const scale = m === 0 ? 1 : Math.abs(m) === 1 ? a.e : a.e * a.e;
    sum += coefficient * scale * trig(d * a.d + m * a.m + mp * a.mp + f * a.f);
  }
  return sum;
}

export interface EclipticOfDate {
  readonly longitudeDeg: number;
  readonly latitudeDeg: number;
  readonly distanceKm: number;
}

/**
 * Geocentric position of the Moon's centre from Meeus, *Astronomical
 * Algorithms* (2nd ed.) ch. 47, truncated to the terms in `moon-terms.ts`.
 * Geometric (no light-time, no nutation), mean ecliptic and equinox of
 * date, then rotated to J2000. Checked against JPL DE421 in the tests.
 * Input: UTC Date. Output: km, J2000.
 */
export function moonPositionJ2000Km(at: Date): EciVec3<number> {
  const { longitudeDeg, latitudeDeg, distanceKm } = moonEclipticOfDate(at);
  return eclipticOfDateToJ2000Km(longitudeDeg, latitudeDeg, distanceKm, at);
}

/** The same Moon in mean ecliptic coordinates of date. Input: UTC Date. Output: degrees, degrees, km. */
export function moonEclipticOfDate(at: Date): EclipticOfDate {
  const t = julianCenturiesTTFromUtc(at);
  const t2 = t * t;
  const t3 = t2 * t;
  const t4 = t3 * t;
  const lp = wrapDeg(218.3164477 + 481267.88123421 * t - 0.0015786 * t2 + t3 / 538841 - t4 / 65194000);
  const args: Arguments = {
    d: wrapDeg(297.8501921 + 445267.1114034 * t - 0.0018819 * t2 + t3 / 545868 - t4 / 113065000) * DEG,
    m: wrapDeg(357.5291092 + 35999.0502909 * t - 0.0001536 * t2 + t3 / 24490000) * DEG,
    mp: wrapDeg(134.9633964 + 477198.8675055 * t + 0.0087414 * t2 + t3 / 69699 - t4 / 14712000) * DEG,
    f: wrapDeg(93.272095 + 483202.0175233 * t - 0.0036539 * t2 - t3 / 3526000 + t4 / 863310000) * DEG,
    e: 1 - 0.002516 * t - 0.0000074 * t2,
  };

  // The three additive terms: Venus (A1), Jupiter (A2), Earth's flattening (L′ in Σb).
  const a1 = wrapDeg(119.75 + 131.849 * t) * DEG;
  const a2 = wrapDeg(53.09 + 479264.29 * t) * DEG;
  const a3 = wrapDeg(313.45 + 481266.484 * t) * DEG;
  const lpRad = lp * DEG;

  const sumL =
    sumTerms(MOON_LONGITUDE_TERMS, args, Math.sin) +
    3958 * Math.sin(a1) +
    1962 * Math.sin(lpRad - args.f) +
    318 * Math.sin(a2);
  const sumB =
    sumTerms(MOON_LATITUDE_TERMS, args, Math.sin) -
    2235 * Math.sin(lpRad) +
    382 * Math.sin(a3) +
    175 * Math.sin(a1 - args.f) +
    175 * Math.sin(a1 + args.f) +
    127 * Math.sin(lpRad - args.mp) -
    115 * Math.sin(lpRad + args.mp);
  const sumR = sumTerms(MOON_DISTANCE_TERMS, args, Math.cos);

  return {
    longitudeDeg: wrapDeg(lp + sumL / 1e6),
    latitudeDeg: sumB / 1e6,
    distanceKm: 385000.56 + sumR / 1000,
  };
}
