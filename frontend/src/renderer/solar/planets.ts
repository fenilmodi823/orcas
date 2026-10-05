import { GM_SUN } from '@orcas/physics';

export interface Planet {
  readonly name: string;
  /** The DE421 target `planet-ephemeris.ts` carries: a body, or a system barycentre. */
  readonly naifId: number;
  /** Mean radius, km. Drawn as a sphere, so oblateness (Saturn 10 %) is not shown. */
  readonly radiusKm: number;
  /** μ for the heliocentric orbit, G(M_sun + M_system), km³/s². */
  readonly muKm3S2: number;
  /** The orbit-line colour token in tokens.css, and its own value for JSDOM. */
  readonly token: string;
  readonly fallback: string;
}

// Radii: mean radius, IAU WGCCRE 2015 (Archinal et al. 2018, Celest. Mech. Dyn. Astr.
// 130:22), as tabulated by JPL SSD "Planetary Physical Parameters". GM: JPL planetary
// ephemeris DE440, JPL SSD "Astrodynamic Parameters"; a system's GM includes its moons.
// Both read from those pages on 2026-10-06.
const planet = (name: string, naifId: number, radiusKm: number, gmKm3S2: number, fallback: string): Planet => ({
  name,
  naifId,
  radiusKm,
  muKm3S2: GM_SUN + gmKm3S2,
  token: `--${name.toLowerCase()}`,
  fallback,
});

/** The eight planets, inner to outer. Jupiter to Neptune are system barycentres in DE421. */
export const PLANETS: readonly Planet[] = [
  planet('Mercury', 199, 2439.4, 22_031.868551, '#a99e93'),
  planet('Venus', 299, 6051.8, 324_858.592, '#e9cf96'),
  // The Earth's own state, not the Earth–Moon barycentre, so its line passes
  // through the Earth; μ still counts the Moon.
  planet('Earth', 399, 6371.0084, 398_600.435507 + 4_902.800118, '#5fb0c8'),
  planet('Mars', 499, 3389.5, 42_828.375816, '#d46f4d'),
  planet('Jupiter', 5, 69_911, 126_712_764.1, '#d9a37a'),
  planet('Saturn', 6, 58_232, 37_940_584.8418, '#c9b27c'),
  planet('Uranus', 7, 25_362, 5_794_556.4, '#7fd1c7'),
  planet('Neptune', 8, 24_622, 6_836_527.10058, '#5d74c9'),
];

export const SUN_NAIF_ID = 10;
export const EARTH_NAIF_ID = 399;

/** Said on screen where the planets are drawn (Rules §7, Cosmic-Scales §3.4: each scale states what its positions are worth). */
export const PLANET_CREDIT =
  'Sun and planets: JPL DE421, interpolated to within 1″; Jupiter to Neptune at their system barycentres.';
