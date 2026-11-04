import type { Vector3 } from 'three';
import { bodyStateKm, etSecondsFromUtcMs, type PlanetEphemeris } from '../../data/planet-ephemeris.js';
import { moonPositionJ2000Km } from '@orcas/physics';
import { moonSystem, type HorizonsFileId, type MoonSystemId } from '../../data/moon-systems.js';
import { EARTH_NAIF_ID } from './planets.js';

const _state = new Float64Array(6);
const SSB_NAIF_ID = 0;
const MOON_NAIF_ID = 301;

/** The planet centres the export carries, relative to their system barycentres (S6a), by the planet's NAIF id. */
const PLANET_CENTRES: Readonly<Record<number, MoonSystemId>> = { 599: 'jupiter', 699: 'saturn', 799: 'uranus', 899: 'neptune' };

/**
 * A target's state relative to its export centre at a UTC instant, into `out6` (km, km/s, ICRF), returning the
 * centre's NAIF id. Null before its system loads, or where the export has no data (B.26: not drawn).
 */
export function horizonsRelativeState(system: HorizonsFileId, naifId: number, epochMs: number, out6: Float64Array): number | null {
  return moonSystem(system)?.stateInto(naifId, etSecondsFromUtcMs(epochMs), out6) ?? null;
}

/**
 * Where a Horizons centre is at a UTC instant, geocentric km in ICRF (≈ J2000), the scene's frame (S6c):
 * the Solar System barycentre is minus the Earth; the Moon is M1.11's, the one the scene draws, so a lunar
 * orbiter sits right on the drawn Moon; the Earth is the origin; any other body is DE421's. Null before DE421
 * loads for a centre that needs it.
 */
export function centreGeocentricKm(centre: number, epochMs: number, planets: PlanetEphemeris | null, out: Vector3): Vector3 | null {
  if (centre === EARTH_NAIF_ID) return out.set(0, 0, 0);
  if (centre === MOON_NAIF_ID) {
    const m = moonPositionJ2000Km(new Date(epochMs));
    return out.set(m.x, m.y, m.z);
  }
  const earth = planets && bodyStateKm(planets, EARTH_NAIF_ID, epochMs);
  if (!planets || !earth) return null;
  if (centre === SSB_NAIF_ID) return out.set(-earth.position.x, -earth.position.y, -earth.position.z);
  const c = bodyStateKm(planets, centre, epochMs);
  return c ? out.set(c.position.x - earth.position.x, c.position.y - earth.position.y, c.position.z - earth.position.z) : null;
}

/**
 * A target's place at a UTC instant: its centre's (above) plus the export's centre-relative offset, geocentric km
 * in ICRF (S6b, S6c). Null before its file loads, before a centre that needs DE421 can be placed, or where the
 * export has no data.
 */
export function horizonsGeocentricKm(
  file: HorizonsFileId,
  naifId: number,
  epochMs: number,
  planets: PlanetEphemeris | null,
  out: Vector3,
): Vector3 | null {
  const centre = horizonsRelativeState(file, naifId, epochMs, _state);
  if (centre === null || !centreGeocentricKm(centre, epochMs, planets, out)) return null;
  return out.set(out.x + (_state[0] ?? NaN), out.y + (_state[1] ?? NaN), out.z + (_state[2] ?? NaN));
}

/**
 * Move a giant planet from its system barycentre (DE421, already in `out`, geocentric km) to its own centre,
 * where its moon system has loaded and the export covers the instant (S6b): up to 220 km for Jupiter and 312 km
 * for Saturn, enough to part a moon from its trail close up. Returns whether it moved.
 */
export function applyPlanetCentre(planetNaifId: number, epochMs: number, out: Vector3): boolean {
  const system = PLANET_CENTRES[planetNaifId];
  if (!system) return false;
  const centre = horizonsRelativeState(system, planetNaifId, epochMs, _state);
  if (centre !== Math.floor(planetNaifId / 100)) return false; // relative to its own barycentre, or not at all
  out.x += _state[0] ?? 0;
  out.y += _state[1] ?? 0;
  out.z += _state[2] ?? 0;
  return true;
}

/** Whether `applyPlanetCentre` would move this planet now: the panel's position note says which centre it is. */
export function planetCentreFromHorizons(planetNaifId: number, epochMs: number): boolean {
  const system = PLANET_CENTRES[planetNaifId];
  return system !== undefined && horizonsRelativeState(system, planetNaifId, epochMs, _state) === Math.floor(planetNaifId / 100);
}
