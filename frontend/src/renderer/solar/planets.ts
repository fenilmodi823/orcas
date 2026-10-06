import { GM_SUN } from '@orcas/physics';

export interface Planet {
  readonly name: string;
  /** The DE421 target `planet-ephemeris.ts` carries: a body, or a system barycentre. */
  readonly naifId: number;
  /** Mean radius, km: what hides a label and bounds the near plane. */
  readonly radiusKm: number;
  /** Equatorial radius, km: what NASA Eyes frames a body by on arrival (Reference §4.5). */
  readonly equatorialRadiusKm: number;
  /** Polar radius, km: the body is drawn as the IAU ellipsoid (S5b), Saturn 10 % flatter at the poles. */
  readonly polarRadiusKm: number;
  /** The body's own NAIF id, for its IAU pole: Jupiter's 599, where `naifId` is its system's 5. */
  readonly bodyNaifId: number;
  /** μ for the heliocentric orbit, G(M_sun + M_system), km³/s². */
  readonly muKm3S2: number;
  /** The orbit-line colour token in tokens.css, and its own value for JSDOM. */
  readonly token: string;
  readonly fallback: string;
}

// Radii: mean radius, IAU WGCCRE 2015 (Archinal et al. 2018, Celest. Mech. Dyn. Astr.
// 130:22), as tabulated by JPL SSD "Planetary Physical Parameters". GM: JPL planetary
// ephemeris DE440, JPL SSD "Astrodynamic Parameters"; a system's GM includes its moons.
// Both read from those pages on 2026-10-06. Equatorial and polar radii: the same IAU 2015 values, as NAIF's
// pck00011.tpc carries them (BODYnnn_RADII), read on 2026-10-06.
const planet = (
  name: string,
  naifId: number,
  bodyNaifId: number,
  radiusKm: number,
  [equatorialRadiusKm, polarRadiusKm]: readonly [number, number],
  gmKm3S2: number,
  fallback: string,
): Planet => ({
  name,
  naifId,
  bodyNaifId,
  radiusKm,
  equatorialRadiusKm,
  polarRadiusKm,
  muKm3S2: GM_SUN + gmKm3S2,
  token: `--${name.toLowerCase()}`,
  fallback,
});

/** The eight planets, inner to outer. Jupiter to Neptune are system barycentres in DE421. */
export const PLANETS: readonly Planet[] = [
  planet('Mercury', 199, 199, 2439.4, [2440.53, 2438.26], 22_031.868551, '#a99e93'),
  planet('Venus', 299, 299, 6051.8, [6051.8, 6051.8], 324_858.592, '#e9cf96'),
  // The Earth's own state, not the Earth–Moon barycentre, so its line passes
  // through the Earth; μ still counts the Moon.
  planet('Earth', 399, 399, 6371.0084, [6378.1366, 6356.7519], 398_600.435507 + 4_902.800118, '#5fb0c8'),
  planet('Mars', 499, 499, 3389.5, [3396.19, 3376.2], 42_828.375816, '#d46f4d'),
  planet('Jupiter', 5, 599, 69_911, [71_492, 66_854], 126_712_764.1, '#d9a37a'),
  planet('Saturn', 6, 699, 58_232, [60_268, 54_364], 37_940_584.8418, '#c9b27c'),
  planet('Uranus', 7, 799, 25_362, [25_559, 24_973], 5_794_556.4, '#7fd1c7'),
  planet('Neptune', 8, 899, 24_622, [24_764, 24_341], 6_836_527.10058, '#5d74c9'),
];

export const SUN_NAIF_ID = 10;
export const EARTH_NAIF_ID = 399;

/** Said on screen where the planets are drawn (Rules §7, Cosmic-Scales §3.4: each scale states what its positions are worth). */
export const PLANET_CREDIT =
  'Sun and planets: JPL DE421, interpolated to within 1″; Jupiter to Neptune at their system barycentres.';
