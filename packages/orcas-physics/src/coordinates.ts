import { gstime } from 'satellite.js';
import type { EciVec3 } from 'satellite.js';
import type { GeodeticPosition } from './types.js';

/** Greenwich Mean Sidereal Time at a given instant. Input: JS Date (UTC). Output: radians. */
export function gmstRad(at: Date): number {
  return gstime(at);
}

export const WGS84_A_KM = 6378.137; // WGS-84 semi-major axis
const F = 1 / 298.257223563; // WGS-84 flattening (exact value)
export const WGS84_B_KM = WGS84_A_KM * (1 - F); // 6356.752314245 km
const E2 = F * (2 - F); // 0.00669437999014132
const EP2 = E2 / (1 - E2); // second eccentricity squared
const TWO_PI = 2 * Math.PI;

/**
 * Rotate a TEME position into geodetic lat/lon/altitude via a bare
 * z-rotation by GMST followed by Bowring's closed-form parametric-latitude
 * method (no iteration). Replaces the satellite.js `eciToGeodetic` call,
 * which returns -6399.59 km instead of +443.25 km at the exact pole
 * (x=y=0) — see ORCAS Vault Phase-4 Engineering Brief Part 3.3 (Bug 2).
 * ~9.6x faster at 46k objects and accurate to ~5 cm / ~0.31 m vs a
 * 60-iteration reference. Input: TEME position (km), GMST (rad). Output:
 * degrees, degrees, km above WGS84.
 */
export function eciToGeodeticDeg(positionEciKm: EciVec3<number>, gmst: number): GeodeticPosition {
  const { x, y, z } = positionEciKm;
  const r = Math.hypot(x, y); // rotation-invariant: same in ECI and ECEF

  const lon = ((((Math.atan2(y, x) - gmst + Math.PI) % TWO_PI) + TWO_PI) % TWO_PI) - Math.PI;

  if (r < 1e-9) {
    // On the spin axis — atan2(y, x) above and the Bowring step below are
    // both singular here.
    const sign = z >= 0 ? 1 : -1;
    return { latitudeDeg: 90 * sign, longitudeDeg: 0, altitudeKm: Math.abs(z) - WGS84_B_KM };
  }

  const th = Math.atan2(WGS84_A_KM * z, WGS84_B_KM * r);
  const st = Math.sin(th);
  const ct = Math.cos(th);
  const lat = Math.atan2(z + EP2 * WGS84_B_KM * st ** 3, r - E2 * WGS84_A_KM * ct ** 3);

  const sinLat = Math.sin(lat);
  const n = WGS84_A_KM / Math.sqrt(1 - E2 * sinLat * sinLat);
  // near the poles, r/cos(lat) is ill-conditioned; switch height branch
  // at |lat| > 30 deg (|sin(lat)| > 0.5).
  const height = Math.abs(sinLat) > 0.5 ? z / sinLat - n * (1 - E2) : r / Math.cos(lat) - n;

  return {
    latitudeDeg: (lat * 180) / Math.PI,
    longitudeDeg: (lon * 180) / Math.PI,
    altitudeKm: height,
  };
}
