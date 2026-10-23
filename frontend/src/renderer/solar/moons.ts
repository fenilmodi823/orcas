import { MOON_SYSTEMS, type MoonSystemId } from '../../data/moon-systems.js';

export interface Moon {
  /** URL-safe body id: `?object=io`. */
  readonly id: string;
  readonly name: string;
  readonly naifId: number;
  /** Its planet's body id, which is also its S6a export file. */
  readonly system: MoonSystemId;
  /** a ≥ b ≥ c, km: IAU 2015 (Archinal et al. 2018), NAIF pck00011 BODYnnn_RADII, read 2026-10-12. */
  readonly radiiKm: readonly [number, number, number];
}

const moon = (id: string, name: string, naifId: number, system: MoonSystemId, radiiKm: readonly [number, number, number]): Moon => ({
  id,
  name,
  naifId,
  system,
  radiiKm,
});

/**
 * NASA Eyes' "Major Moons" for Mars to Neptune (its entity list, `preload.js`, read 2026-10-12): the 19 the
 * S6a export carries, inner to outer within each system.
 */
export const MOONS: readonly Moon[] = [
  moon('phobos', 'Phobos', 401, 'mars', [13.0, 11.4, 9.1]),
  moon('deimos', 'Deimos', 402, 'mars', [7.8, 6.0, 5.1]),
  moon('io', 'Io', 501, 'jupiter', [1829.4, 1819.4, 1815.7]),
  moon('europa', 'Europa', 502, 'jupiter', [1562.6, 1560.3, 1559.5]),
  moon('ganymede', 'Ganymede', 503, 'jupiter', [2631.2, 2631.2, 2631.2]),
  moon('callisto', 'Callisto', 504, 'jupiter', [2410.3, 2410.3, 2410.3]),
  moon('mimas', 'Mimas', 601, 'saturn', [207.8, 196.7, 190.6]),
  moon('enceladus', 'Enceladus', 602, 'saturn', [256.6, 251.4, 248.3]),
  moon('tethys', 'Tethys', 603, 'saturn', [538.4, 528.3, 526.3]),
  moon('dione', 'Dione', 604, 'saturn', [563.4, 561.3, 559.6]),
  moon('rhea', 'Rhea', 605, 'saturn', [765.0, 763.1, 762.4]),
  moon('titan', 'Titan', 606, 'saturn', [2575.15, 2574.78, 2574.47]),
  moon('iapetus', 'Iapetus', 608, 'saturn', [745.7, 745.7, 712.1]),
  moon('miranda', 'Miranda', 705, 'uranus', [240.4, 234.2, 232.9]),
  moon('ariel', 'Ariel', 701, 'uranus', [581.1, 577.9, 577.7]),
  moon('umbriel', 'Umbriel', 702, 'uranus', [584.7, 584.7, 584.7]),
  moon('titania', 'Titania', 703, 'uranus', [788.9, 788.9, 788.9]),
  moon('oberon', 'Oberon', 704, 'uranus', [761.4, 761.4, 761.4]),
  moon('triton', 'Triton', 801, 'neptune', [1352.6, 1352.6, 1352.6]),
];

/**
 * Each system's extent, km: its outermost major moon's greatest distance from the export's centre over every
 * keyframe of the S6a export, rounded up (measured 2026-10-12). What the system fades by (S4's rule) and what
 * bounds its System view.
 */
export const SYSTEM_RADIUS_KM: Readonly<Record<MoonSystemId, number>> = {
  mars: 23_467, // Deimos
  jupiter: 1_896_879, // Callisto
  saturn: 3_663_189, // Iapetus
  uranus: 584_996, // Oberon
  neptune: 354_730, // Triton
};

/** The moon system a body belongs to: a moon's, or a planet's own; null for anything else. */
export function moonSystemOf(bodyId: string | null): MoonSystemId | null {
  if (bodyId === null) return null;
  const m = MOONS.find((x) => x.id === bodyId);
  if (m) return m.system;
  return MOON_SYSTEMS.find((s) => s === bodyId) ?? null;
}

/** Said on screen where the moons are drawn (Rules §7): the trajectories are a dated export, never live. */
export const MOON_CREDIT = 'Major moons, and Jupiter to Neptune’s centres: JPL Horizons, exported 2026-10-06 UTC, static.';
