/**
 * Canonical OMM record, CelesTrak GP JSON schema (CCSDS OMM fields).
 * This is the literal input shape `satellite.js json2satrec()` expects —
 * see ORCAS Vault/01 - Product/Data-Strategy.md §9.1 and §9.4.
 *
 * Units follow CCSDS OMM (degrees, rev/day), NOT satellite.js internal
 * radian/minute units. satellite.js converts at json2satrec() time.
 */
export interface OmmRecord {
  OBJECT_NAME: string;
  OBJECT_ID: string;
  /** International designator string, e.g. "2026-001A". */
  EPOCH: string;
  /** ISO 8601 timestamp, UTC. */
  MEAN_MOTION: number;
  /** rev/day */
  ECCENTRICITY: number;
  /** dimensionless */
  INCLINATION: number;
  /** deg */
  RA_OF_ASC_NODE: number;
  /** deg */
  ARG_OF_PERICENTER: number;
  /** deg */
  MEAN_ANOMALY: number;
  /** deg */
  EPHEMERIS_TYPE: number;
  CLASSIFICATION_TYPE: string;
  /** VARCHAR — 6-digit and Alpha-5 catalog numbers are not integers. */
  NORAD_CAT_ID: string;
  ELEMENT_SET_NO: number;
  REV_AT_EPOCH: number;
  /** 1/earth-radii */
  BSTAR: number;
  /** rev/day^2 */
  MEAN_MOTION_DOT: number;
  /** rev/day^3 */
  MEAN_MOTION_DDOT: number;
}

/** Position and velocity in the ECI frame, km and km/s. */
export interface SatState {
  positionEciKm: { x: number; y: number; z: number };
  velocityEciKmS: { x: number; y: number; z: number };
  /** JS Date the state was propagated to. */
  at: Date;
}

/** Geodetic position: degrees, degrees, km above the WGS84 ellipsoid. */
export interface GeodeticPosition {
  latitudeDeg: number;
  longitudeDeg: number;
  altitudeKm: number;
}
