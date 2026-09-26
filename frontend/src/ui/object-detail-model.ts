import { eciToGeodeticDeg, gmstRad, propagate, WGS84_A_KM, type satrecFromOmm } from '@orcas/physics';
import { ObjType, OrbitClass } from '../data/catalog-types.js';
import type { ObjectMeta } from '../data/catalog-types.js';
import { formatAge, formatEpochUtc } from '../data/catalog-provenance.js';

/** Derived from the physics package rather than imported from satellite.js,
 * which `@orcas/physics` exists to wrap. */
type SatRec = ReturnType<typeof satrecFromOmm>;

const EARTH_MU_KM3_S2 = 398600.4418;
const SECONDS_PER_DAY = 86_400;

export interface DetailField {
  readonly label: string;
  readonly value: number | string;
  readonly unit?: string;
  readonly precision?: number;
}

export type DetailGroupId = 'identity' | 'kinematics' | 'orbit' | 'provenance' | 'conjunction';

export interface DetailGroup {
  readonly id: DetailGroupId;
  readonly title: string;
  readonly fields: readonly DetailField[];
}

/**
 * The reserved Phase 5 slot (brief §13.4.2). Deliberately has no bare
 * probability field: public element sets carry no covariance, so what ORCAS
 * shows is a *maximum* probability over a stated family of uncertainty
 * ellipses, and it is meaningless without that family, the hard-body radius
 * and the method (RA-12 §7). This shape mirrors the backend's `MaximumPc`, so
 * an unlabelled P_c cannot be constructed here any more than there.
 */
export interface ConjunctionSummary {
  readonly counterpartName: string;
  readonly missDistanceKm: number;
  readonly maximumPc: number;
  readonly aspectRatio: number;
  readonly hardBodyRadiusKm: number;
  /** One-line method statement, e.g. "upper bound over 3:1 ellipses (Alfano 2005)". */
  readonly method: string;
}

const TYPE_LABELS: Record<ObjType, string> = {
  [ObjType.Payload]: 'Payload',
  [ObjType.RocketBody]: 'Rocket body',
  [ObjType.Debris]: 'Debris',
  [ObjType.Unknown]: 'Unknown',
};

const ORBIT_CLASS_LABELS: Record<OrbitClass, string> = {
  [OrbitClass.LEO]: 'LEO',
  [OrbitClass.MEO]: 'MEO',
  [OrbitClass.GEO]: 'GEO',
  [OrbitClass.HEO]: 'HEO',
  [OrbitClass.Unknown]: 'Unknown',
};

/** Orbital period from OMM mean motion. Input rev/day, output minutes. */
export function periodMinutes(meanMotionRevDay: number): number {
  return (24 * 60) / meanMotionRevDay;
}

/**
 * Apogee and perigee altitude above the WGS84 equatorial radius, from the
 * two-body semi-major axis of the OMM mean elements. A display figure,
 * good to a few kilometres — mean elements are fitted, not osculating.
 * Output: km.
 */
export function apsidesKm(meanMotionRevDay: number, eccentricity: number): { apogeeKm: number; perigeeKm: number } {
  const meanMotionRadS = (meanMotionRevDay * 2 * Math.PI) / SECONDS_PER_DAY;
  const semiMajorAxisKm = Math.cbrt(EARTH_MU_KM3_S2 / (meanMotionRadS * meanMotionRadS));
  return {
    apogeeKm: semiMajorAxisKm * (1 + eccentricity) - WGS84_A_KM,
    perigeeKm: semiMajorAxisKm * (1 - eccentricity) - WGS84_A_KM,
  };
}

function kinematicsAt(satrec: SatRec, object: ObjectMeta, atMs: number): DetailField[] {
  // TEME, straight from SGP4 — eciToGeodeticDeg expects TEME, and the frame
  // state's positions are J2000, which would shift longitude by the ~0.36°
  // of precession since 2000. One object at display cadence costs nothing.
  try {
    const at = new Date(atMs);
    const state = propagate(satrec, at, object.norad);
    const geo = eciToGeodeticDeg(state.positionEciKm, gmstRad(at));
    const v = state.velocityEciKmS;
    return [
      { label: 'Altitude', value: geo.altitudeKm, unit: 'km', precision: 1 },
      { label: 'Velocity', value: Math.hypot(v.x, v.y, v.z), unit: 'km/s', precision: 2 },
      { label: 'Latitude', value: geo.latitudeDeg, unit: '°', precision: 2 },
      { label: 'Longitude', value: geo.longitudeDeg, unit: '°', precision: 2 },
    ];
  } catch {
    // Outside what SGP4 can propagate (decayed, or far past its epoch). The
    // group collapses rather than showing a confident wrong number.
    return [];
  }
}

/**
 * The info panel's field groups, in the brief's order (§13.4.2): Identity,
 * Kinematics, Orbit, Provenance, Conjunction. A group with nothing to show is
 * dropped, never rendered as blanks. `simulationMs` is the simulated instant
 * the kinematics are evaluated at; `nowMs` is the wall clock the element-set
 * age is measured against — two different clocks, deliberately.
 */
export function buildDetailGroups(
  object: ObjectMeta,
  satrec: SatRec | null,
  simulationMs: number,
  nowMs: number,
  conjunction?: ConjunctionSummary,
): DetailGroup[] {
  const { record } = object;
  const { apogeeKm, perigeeKm } = apsidesKm(record.MEAN_MOTION, record.ECCENTRICITY);
  const ahead = object.epochMs > nowMs;

  const groups: DetailGroup[] = [
    {
      id: 'identity',
      title: 'Identity',
      fields: [
        { label: 'NORAD ID', value: object.norad },
        { label: 'Int’l designator', value: object.objectId },
        { label: 'Type', value: TYPE_LABELS[object.type] },
        { label: 'Orbit class', value: ORBIT_CLASS_LABELS[object.orbitClass] },
      ],
    },
    {
      id: 'kinematics',
      title: 'Kinematics',
      fields: satrec ? kinematicsAt(satrec, object, simulationMs) : [],
    },
    {
      id: 'orbit',
      title: 'Orbit',
      fields: [
        { label: 'Inclination', value: record.INCLINATION, unit: '°', precision: 2 },
        { label: 'Eccentricity', value: record.ECCENTRICITY, precision: 5 },
        { label: 'Period', value: periodMinutes(record.MEAN_MOTION), unit: 'min', precision: 1 },
        { label: 'Apogee', value: apogeeKm, unit: 'km', precision: 0 },
        { label: 'Perigee', value: perigeeKm, unit: 'km', precision: 0 },
        { label: 'RAAN', value: record.RA_OF_ASC_NODE, unit: '°', precision: 2 },
      ],
    },
    {
      id: 'provenance',
      title: 'Provenance',
      fields: [
        // The element-set epoch is always shown (Design.md §4).
        { label: 'Element-set epoch', value: formatEpochUtc(object.epochMs) },
        { label: 'Age', value: ahead ? 'published ahead of now' : formatAge(nowMs - object.epochMs) },
        { label: 'Source', value: object.source },
      ],
    },
  ];

  if (conjunction) {
    groups.push({
      id: 'conjunction',
      title: 'Conjunction',
      fields: [
        { label: 'With', value: conjunction.counterpartName },
        { label: 'Miss distance', value: conjunction.missDistanceKm * 1000, unit: 'm', precision: 0 },
        { label: 'Maximum P_c', value: conjunction.maximumPc.toExponential(2) },
        { label: 'Assumed ellipse', value: `${conjunction.aspectRatio}:1` },
        { label: 'Hard-body radius', value: conjunction.hardBodyRadiusKm * 1000, unit: 'm', precision: 0 },
        { label: 'Method', value: conjunction.method },
      ],
    });
  }

  return groups.filter((group) => group.fields.length > 0);
}
