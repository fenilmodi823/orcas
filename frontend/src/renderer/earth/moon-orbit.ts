import { moonPositionJ2000Km, writeOsculatingEllipse } from '@orcas/physics';
import { ORBIT_SAMPLES } from '../solar/orbit-line.js';
import { EARTH_NAIF_ID, PLANETS } from '../solar/planets.js';

/**
 * NASA draws the Moon with the planets' orbit line, not a moon trail (its TrailManager's `_orbitLineEntityNames`,
 * app.js, read 2026-10-12), at the secondary opacity 0.35, 1.2 px, 2 px on hover. ORCAS's colour is its own
 * natural-body token, `--moon`, never NASA's white.
 */
export const MOON_ORBIT_OPACITY = 0.35;
export const MOON_ORBIT_WIDTH_PX = 1.2;
export const MOON_ORBIT_HOVER_WIDTH_PX = 2;
/** μ for the Moon about the Earth, G(M⊕ + M☾): the Earth's system GM (DE440), km³/s². */
const MU_KM3_S2 = PLANETS.find((p) => p.naifId === EARTH_NAIF_ID)?.gmKm3S2 ?? NaN;
/** M1.11's Moon has no velocity; a central difference over ±30 s, in which the Moon turns 0.0046°. */
const HALF_STEP_MS = 30_000;

/**
 * The Moon's osculating orbit about the Earth at a UTC instant (S6b): ORBIT_SAMPLES points in eccentric anomaly
 * from the Moon round to the Moon, geocentric km, J2000, into `out`. False for an unbound state, never the Moon's.
 */
export function writeMoonOrbit(epochMs: number, out: Float64Array): boolean {
  const r = moonPositionJ2000Km(new Date(epochMs));
  const before = moonPositionJ2000Km(new Date(epochMs - HALF_STEP_MS));
  const after = moonPositionJ2000Km(new Date(epochMs + HALF_STEP_MS));
  const dtS = (2 * HALF_STEP_MS) / 1000;
  const v = { x: (after.x - before.x) / dtS, y: (after.y - before.y) / dtS, z: (after.z - before.z) / dtS };
  return writeOsculatingEllipse(r, v, MU_KM3_S2, ORBIT_SAMPLES, out);
}
