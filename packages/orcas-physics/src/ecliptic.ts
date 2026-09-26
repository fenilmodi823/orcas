import type { EciVec3 } from 'satellite.js';
import { applyMat3, temeToJ2000Matrix } from './frames.js';

const DEG = Math.PI / 180;
const J2000_JD = 2451545.0;
const UNIX_EPOCH_JD = 2440587.5;

/**
 * TT − UTC, seconds: 32.184 s (TT − TAI) + 37 s of leap seconds (TAI − UTC
 * since 2017-01-01). Constant until the next leap second; none is scheduled.
 * TDB differs from TT by under 2 ms, which is ignored.
 */
export const TT_MINUS_UTC_S = 69.184;

/** Julian centuries of TT since J2000.0 for a UTC instant. Input: UTC Date. */
export function julianCenturiesTTFromUtc(at: Date): number {
  const jdTT = (at.getTime() / 1000 + TT_MINUS_UTC_S) / 86_400 + UNIX_EPOCH_JD;
  return (jdTT - J2000_JD) / 36525;
}

/** Normalise an angle to [0, 360) degrees. */
export function wrapDeg(angleDeg: number): number {
  return ((angleDeg % 360) + 360) % 360;
}

/**
 * Mean obliquity of the ecliptic, IAU 1980 (Meeus eq. 22.2). Input: Julian
 * centuries TT. Output: degrees.
 */
export function meanObliquityDeg(t: number): number {
  const arcsec = 21.448 - 46.815 * t - 0.00059 * t * t + 0.001813 * t * t * t;
  return 23 + 26 / 60 + arcsec / 3600;
}

/**
 * Geocentric ecliptic coordinates (mean ecliptic and equinox of date) to a
 * J2000 equatorial position vector. Rotates about x by the mean obliquity to
 * reach the mean equator of date, then precesses to J2000 with the same
 * IAU 1976 matrix the SGP4 path uses (`temeToJ2000Matrix` is exactly
 * mean-of-date → J2000). Input: degrees, degrees, km. Output: km, J2000.
 */
export function eclipticOfDateToJ2000Km(
  longitudeDeg: number,
  latitudeDeg: number,
  distanceKm: number,
  at: Date,
): EciVec3<number> {
  const t = julianCenturiesTTFromUtc(at);
  const eps = meanObliquityDeg(t) * DEG;
  const lon = longitudeDeg * DEG;
  const lat = latitudeDeg * DEG;
  const cosLat = Math.cos(lat);
  const xe = distanceKm * cosLat * Math.cos(lon);
  const ye = distanceKm * cosLat * Math.sin(lon);
  const ze = distanceKm * Math.sin(lat);
  const ofDate = {
    x: xe,
    y: ye * Math.cos(eps) - ze * Math.sin(eps),
    z: ye * Math.sin(eps) + ze * Math.cos(eps),
  };
  return applyMat3(temeToJ2000Matrix(at), ofDate);
}
