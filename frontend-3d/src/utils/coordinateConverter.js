/**
 * Coordinate system transformations for orbital tracking.
 */

/**
 * Converts Geodetic coordinates (lat, lon, alt) to Cartesian (x, y, z)
 * for rendering on a 3D Earth globe.
 * @param {number} lat - Latitude in degrees
 * @param {number} lon - Longitude in degrees
 * @param {number} alt - Altitude above Earth's surface (scaled)
 * @param {number} earthRadius - Sphere radius of the Earth model in Three.js units
 * @returns {Array<number>} [x, y, z] position in Three.js space
 */
export function geodeticToCartesian(lat, lon, alt, earthRadius = 2.0) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const r = earthRadius + alt;

  const x = -(r * Math.sin(phi) * Math.sin(theta));
  const y = r * Math.cos(phi);
  const z = r * Math.sin(phi) * Math.cos(theta);

  return [x, y, z];
}

/**
 * Converts spherical coordinates (radius, theta, phi) to Cartesian.
 * Used for placing debris fields or stars.
 */
export function sphericalToCartesian(r, theta, phi) {
  const x = r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.sin(phi) * Math.sin(theta);
  const z = r * Math.cos(phi);
  return [x, y, z];
}
