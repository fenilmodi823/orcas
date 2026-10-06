import { julianCenturiesTTFromUtc, wrapDeg } from './ecliptic.js';

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

type Vec3 = { x: number; y: number; z: number };

const term = (q: PeriodicTerm | undefined, t: number, f: (rad: number) => number) => (q ? q[0] * f((q[1] + q[2] * t) * DEG) : 0);

/** The pole's right ascension and declination, radians, at T Julian centuries TDB. */
function poleRaDecRad(p: IauPole, t: number): { ra: number; dec: number } {
  return {
    ra: (p.ra0Deg + p.raDegPerCentury * t + term(p.raTerm, t, Math.sin)) * DEG,
    dec: (p.dec0Deg + p.decDegPerCentury * t + term(p.decTerm, t, Math.cos)) * DEG,
  };
}

/**
 * A body's north pole at a UTC instant, as a unit vector in ICRF (≈ J2000 equatorial). Null for a body the
 * table does not carry, such as a system barycentre.
 */
export function iauPoleJ2000(naifId: number, at: Date): Vec3 | null {
  const p = IAU_POLES[naifId];
  if (!p) return null;
  const { ra, dec } = poleRaDecRad(p, julianCenturiesTTFromUtc(at)); // TDB − TT is under 2 ms
  return { x: Math.cos(dec) * Math.cos(ra), y: Math.cos(dec) * Math.sin(ra), z: Math.sin(dec) };
}

/** A body's prime meridian, degrees, d in days TDB from J2000: W = W₀ + Ẇ·d + a·sin θ, θ as in `PeriodicTerm`. */
export interface IauPrimeMeridian {
  readonly w0Deg: number;
  readonly wDegPerDay: number;
  readonly term?: PeriodicTerm;
}

const pm = (w0Deg: number, wDegPerDay: number, t?: PeriodicTerm): IauPrimeMeridian => ({ w0Deg, wDegPerDay, term: t });

/**
 * Prime meridians, keyed by NAIF body id: pck00011 BODYnnn_PM (IAU WGCCRE 2015), transcribed 2026-10-06, each
 * with its largest periodic term (BODYnnn_NUT_PREC_PM): Mars's 0.585° and Neptune's 0.48°. ⚠️ Mercury's terms,
 * at most 0.011°, are left out. Ẇ is negative for Venus and Uranus, which turn against their IAU north. Not here:
 * the Earth, turned by GMST (`earth-orientation.ts`), and the Moon, tidally locked in the scene.
 */
export const IAU_PRIME_MERIDIANS: Readonly<Record<number, IauPrimeMeridian>> = {
  10: pm(84.176, 14.1844), // Sun
  199: pm(329.5988, 6.1385108), // Mercury
  299: pm(160.2, -1.4813688), // Venus
  499: pm(176.049863, 350.891982443297, [0.584542, 95.391654, 0.5042615]), // Mars
  599: pm(284.95, 870.536), // Jupiter, System III
  699: pm(38.9, 810.7939024), // Saturn, System III
  799: pm(203.81, -501.1600928), // Uranus
  899: pm(249.978, 541.1397757, [-0.48, 357.85, 52.316]), // Neptune
};

/** Body-fixed axes as unit vectors in ICRF (≈ J2000 equatorial). */
export interface BodyAxes {
  /** On the equator, through the prime meridian (longitude 0). */
  readonly x: Vec3;
  /** On the equator, at 90° east longitude: z × x. */
  readonly y: Vec3;
  /** The IAU north pole. */
  readonly z: Vec3;
}

/**
 * A body's IAU body-fixed frame at a UTC instant (Archinal et al. 2018 §2): the pole from `IAU_POLES`, and the
 * prime meridian W degrees east of the ascending node of the body's equator on the ICRF equator, which lies at
 * right ascension α₀ + 90°. Planetocentric east longitude λ is the angle from x toward y. Null for a body
 * without both a pole and a prime meridian.
 */
export function iauBodyAxesJ2000(naifId: number, at: Date): BodyAxes | null {
  const p = IAU_POLES[naifId];
  const m = IAU_PRIME_MERIDIANS[naifId];
  if (!p || !m) return null;
  const t = julianCenturiesTTFromUtc(at);
  const { ra, dec } = poleRaDecRad(p, t);
  const w = wrapDeg(m.w0Deg + m.wDegPerDay * t * 36525 + term(m.term, t, Math.sin)) * DEG;
  const [ca, sa, cd, sd, cw, sw] = [Math.cos(ra), Math.sin(ra), Math.cos(dec), Math.sin(dec), Math.cos(w), Math.sin(w)];
  const z = { x: cd * ca, y: cd * sa, z: sd };
  const node = { x: -sa, y: ca, z: 0 }; // the ascending node, unit, on the ICRF equator
  const north = { x: -sd * ca, y: -sd * sa, z: cd }; // z × node: along the equator, 90° on from the node
  const x = { x: cw * node.x + sw * north.x, y: cw * node.y + sw * north.y, z: cw * node.z + sw * north.z };
  const y = { x: z.y * x.z - z.z * x.y, y: z.z * x.x - z.x * x.z, z: z.x * x.y - z.y * x.x };
  return { x, y, z };
}
