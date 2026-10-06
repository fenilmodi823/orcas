import { Vector3 } from 'three';
import { iauPoleJ2000 } from '@orcas/physics';
import type { PlanetEphemeris } from '../../data/planet-ephemeris.js';
import type { BodyTarget } from '../camera/body-camera.js';
import { bodyById, bodyPositionKm, type Body } from './bodies.js';

/** NASA Eyes' home view: the camera on the Sun at exactly 7.0 × 10⁸ km, 25.0° above the ecliptic (Reference §4.5). */
export const HOME_DISTANCE_KM = 7e8;
const HOME_ELEVATION_RAD = (25 * Math.PI) / 180;

/** The ecliptic's north pole in J2000 equatorial axes; obliquity at J2000, IAU 2006: 84381.406″. */
const OBLIQUITY_RAD = ((84381.406 / 3600) * Math.PI) / 180;
export const ECLIPTIC_NORTH_J2000: Readonly<Vector3> = new Vector3(0, -Math.sin(OBLIQUITY_RAD), Math.cos(OBLIQUITY_RAD));

const SUN = bodyById('sun');
const _p = new Vector3();
const _e1 = new Vector3();
const _e2 = new Vector3();

/** A body as the camera sees it (S5a): its centre, size, IAU pole, and the Sun for its lit side. */
export function bodyTarget(body: Body, ephemeris: { readonly current: PlanetEphemeris | null }): BodyTarget {
  return {
    key: body.id,
    equatorialRadiusKm: body.equatorialRadiusKm,
    positionKm: (epochMs, out) => bodyPositionKm(body, epochMs, ephemeris.current, out),
    poleJ2000: (epochMs, out) => {
      const p = iauPoleJ2000(body.poleNaifId, new Date(epochMs));
      return p ? out.set(p.x, p.y, p.z) : out.copy(ECLIPTIC_NORTH_J2000);
    },
    sunKm: (epochMs, out) => (body.kind === 'star' || !SUN ? null : bodyPositionKm(SUN, epochMs, ephemeris.current, out)),
  };
}

/**
 * Home: where the camera goes relative to the Sun, km, J2000 equatorial. 7.0 × 10⁸ km out and 25° above the
 * ecliptic, as NASA's is, at the ecliptic longitude the camera already has about the Sun, so the move is a
 * pull-back rather than a swing round.
 */
export function homeOffsetKm(cameraKm: Vector3, sunKm: Vector3, out: Vector3): Vector3 {
  _p.copy(cameraKm).sub(sunKm);
  _p.addScaledVector(ECLIPTIC_NORTH_J2000, -_p.dot(ECLIPTIC_NORTH_J2000)); // into the ecliptic plane
  if (_p.lengthSq() < 1e-6) _p.set(1, 0, 0); // straight over the pole: the equinox, which lies in the ecliptic
  _e1.copy(_p).normalize();
  _e2.copy(ECLIPTIC_NORTH_J2000);
  return out
    .copy(_e1)
    .multiplyScalar(Math.cos(HOME_ELEVATION_RAD))
    .addScaledVector(_e2, Math.sin(HOME_ELEVATION_RAD))
    .multiplyScalar(HOME_DISTANCE_KM);
}
