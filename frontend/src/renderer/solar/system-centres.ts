import type { Vector3 } from 'three';
import { bodyStateKm, etSecondsFromUtcMs, type PlanetEphemeris } from '../../data/planet-ephemeris.js';
import { moonSystem, type MoonSystemId } from '../../data/moon-systems.js';
import { EARTH_NAIF_ID } from './planets.js';

const _state = new Float64Array(6);

/** The planet centres the export carries, relative to their system barycentres (S6a), by the planet's NAIF id. */
const PLANET_CENTRES: Readonly<Record<number, MoonSystemId>> = { 599: 'jupiter', 699: 'saturn', 799: 'uranus', 899: 'neptune' };

/**
 * A target's state relative to its export centre at a UTC instant, into `out6` (km, km/s, ICRF), returning the
 * centre's NAIF id. Null before its system loads, or where the export has no data (B.26: not drawn).
 */
export function horizonsRelativeState(system: MoonSystemId, naifId: number, epochMs: number, out6: Float64Array): number | null {
  return moonSystem(system)?.stateInto(naifId, etSecondsFromUtcMs(epochMs), out6) ?? null;
}

/**
 * A major moon's centre at a UTC instant, geocentric km in ICRF (≈ J2000), the scene's frame (S6b). DE421 places
 * the export's centre (a system barycentre, or Mars itself) and the export places the moon from it. Null before
 * either loads, or where the export has no data.
 */
export function horizonsGeocentricKm(
  system: MoonSystemId,
  naifId: number,
  epochMs: number,
  planets: PlanetEphemeris | null,
  out: Vector3,
): Vector3 | null {
  const centre = horizonsRelativeState(system, naifId, epochMs, _state);
  if (centre === null || !planets) return null;
  const earth = bodyStateKm(planets, EARTH_NAIF_ID, epochMs);
  const c = bodyStateKm(planets, centre, epochMs);
  if (!earth || !c) return null;
  return out.set(
    c.position.x - earth.position.x + (_state[0] ?? NaN),
    c.position.y - earth.position.y + (_state[1] ?? NaN),
    c.position.z - earth.position.z + (_state[2] ?? NaN),
  );
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
