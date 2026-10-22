import { Vector3 } from 'three';
import { iauPoleJ2000, moonPositionJ2000Km } from '@orcas/physics';
import type { PlanetEphemeris } from '../../data/planet-ephemeris.js';
import type { SystemMember } from '../camera/system-view.js';
import { BODIES, bodyPositionKm, type Body } from './bodies.js';
import { ECLIPTIC_NORTH_J2000 } from './body-target.js';
import { RING_OUTER_KM } from './saturn-rings.js';

/**
 * What NASA's System view fits (`_goToSystem`'s children, never spacecraft): the body, Saturn with its rings as
 * NASA counts a RingsComponent, and each of its moons that has a position now. Offsets from `centreKm`, km.
 */
export function systemMembers(body: Body, epochMs: number, planets: PlanetEphemeris | null, centreKm: Vector3): SystemMember[] {
  const radiusKm = body.id === 'saturn' ? Math.max(body.equatorialRadiusKm, RING_OUTER_KM) : body.equatorialRadiusKm;
  const members: SystemMember[] = [{ offsetKm: new Vector3(), radiusKm }];
  for (const moon of BODIES) {
    if (moon.kind !== 'moon' || moon.parent !== body.id) continue;
    const at = bodyPositionKm(moon, epochMs, planets, new Vector3());
    if (at) members.push({ offsetKm: at.sub(centreKm), radiusKm: moon.equatorialRadiusKm });
  }
  return members;
}

/**
 * The plane NASA's System view looks down on, unit, into `out`: the body's equator (its IAU pole), or for the
 * Earth the Moon's orbit (NASA's `planeEntity: "moon"`), from M1.11's Moon a minute apart.
 */
export function systemPlaneNormal(body: Body, epochMs: number, out: Vector3): Vector3 {
  if (body.id === 'earth') {
    const r = moonPositionJ2000Km(new Date(epochMs));
    const s = moonPositionJ2000Km(new Date(epochMs + 60_000));
    const v = { x: s.x - r.x, y: s.y - r.y, z: s.z - r.z };
    return out.set(r.y * v.z - r.z * v.y, r.z * v.x - r.x * v.z, r.x * v.y - r.y * v.x).normalize();
  }
  const pole = iauPoleJ2000(body.poleNaifId, new Date(epochMs));
  return pole ? out.set(pole.x, pole.y, pole.z) : out.copy(ECLIPTIC_NORTH_J2000);
}
