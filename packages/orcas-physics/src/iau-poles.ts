import { julianCenturiesTTFromUtc } from './ecliptic.js';

const DEG = Math.PI / 180;

/** One periodic term: amplitude, degrees, of the angle θ = θ₀ + θ₁·T, degrees and degrees per century. */
export type PeriodicTerm = readonly [ampDeg: number, theta0Deg: number, thetaDegPerCentury: number];

/**
 * A body's north pole as the IAU gives it, degrees, T in Julian centuries TDB:
 * α = α₀ + α₁·T + a·sin θa, δ = δ₀ + δ₁·T + d·cos θd.
 */
export interface IauPole {
  readonly ra0Deg: number;
  readonly raDegPerCentury: number;
  readonly dec0Deg: number;
  readonly decDegPerCentury: number;
  readonly raTerm?: PeriodicTerm;
  readonly decTerm?: PeriodicTerm;
}

const pole = (
  ra0Deg: number,
  raDegPerCentury: number,
  dec0Deg: number,
  decDegPerCentury: number,
  raTerm?: PeriodicTerm,
  decTerm?: PeriodicTerm,
): IauPole => ({ ra0Deg, raDegPerCentury, dec0Deg, decDegPerCentury, raTerm, decTerm });

/**
 * North poles in ICRF (≈ J2000 equatorial), keyed by NAIF body id. IAU WGCCRE 2015 (Archinal et al. 2018,
 * Celest. Mech. Dyn. Astr. 130:22), transcribed from NAIF's `pck00011.tpc` (BODYnnn_POLE_RA/DEC) on
 * 2026-10-06. "North" is the pole on the north side of the invariable plane, so Venus's and Uranus's point
 * against their spin.
 *
 * Each body keeps only its largest periodic term, from the same file (BODYnnn_NUT_PREC_RA/DEC with the
 * BODYn_NUT_PREC_ANGLES they multiply): Mars's long-period pair, Neptune's N and the Moon's E1. ⚠️ What is left out
 * is at most 0.12° (the Moon's E2), and under 0.003° for every planet.
 */
export const IAU_POLES: Readonly<Record<number, IauPole>> = {
  10: pole(286.13, 0, 63.87, 0), // Sun
  199: pole(281.0103, -0.0328, 61.4155, -0.0049), // Mercury
  299: pole(272.76, 0, 67.16, 0), // Venus
  399: pole(0, -0.641, 90, -0.557), // Earth
  301: pole(269.9949, 0.0031, 66.5392, 0.013, [-3.8787, 125.045, -1935.5364525], [1.5419, 125.045, -1935.5364525]), // Moon
  499: pole(317.269202, -0.10927547, 54.432516, -0.05827105, [0.419057, 79.398797, 0.5042615], [1.591274, 166.325722, 0.5042615]), // Mars
  599: pole(268.056595, -0.006499, 64.495303, 0.002413), // Jupiter
  699: pole(40.589, -0.036, 83.537, -0.004), // Saturn
  799: pole(257.311, 0, -15.175, 0), // Uranus
  899: pole(299.36, 0, 43.46, 0, [0.7, 357.85, 52.316], [-0.51, 357.85, 52.316]), // Neptune
};

/**
 * A body's north pole at a UTC instant, as a unit vector in ICRF (≈ J2000 equatorial). Null for a body the
 * table does not carry, such as a system barycentre.
 */
export function iauPoleJ2000(naifId: number, at: Date): { x: number; y: number; z: number } | null {
  const p = IAU_POLES[naifId];
  if (!p) return null;
  const t = julianCenturiesTTFromUtc(at); // TDB − TT is under 2 ms
  const term = (q: PeriodicTerm | undefined, f: (rad: number) => number) => (q ? q[0] * f((q[1] + q[2] * t) * DEG) : 0);
  const ra = (p.ra0Deg + p.raDegPerCentury * t + term(p.raTerm, Math.sin)) * DEG;
  const dec = (p.dec0Deg + p.decDegPerCentury * t + term(p.decTerm, Math.cos)) * DEG;
  return { x: Math.cos(dec) * Math.cos(ra), y: Math.cos(dec) * Math.sin(ra), z: Math.sin(dec) };
}
