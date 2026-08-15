import { gstime, eciToGeodetic, degreesLat, degreesLong, type EciVec3 } from 'satellite.js';
import type { GeodeticPosition } from './types.js';

/** Greenwich Mean Sidereal Time at a given instant. Input: JS Date (UTC). Output: radians. */
export function gmstRad(at: Date): number {
  return gstime(at);
}

/**
 * Rotate an ECI position into geodetic lat/lon/altitude.
 * Input: ECI position (km), GMST (rad). Output: degrees, degrees, km above WGS84.
 */
export function eciToGeodeticDeg(positionEciKm: EciVec3<number>, gmst: number): GeodeticPosition {
  const geodetic = eciToGeodetic(positionEciKm, gmst);
  return {
    latitudeDeg: degreesLat(geodetic.latitude),
    longitudeDeg: degreesLong(geodetic.longitude),
    altitudeKm: geodetic.height,
  };
}
