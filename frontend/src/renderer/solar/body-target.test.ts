import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { iauPoleJ2000 } from '@orcas/physics';
import { bodyById } from './bodies.js';
import { bodyTarget, ECLIPTIC_NORTH_J2000, homeOffsetKm, HOME_DISTANCE_KM } from './body-target.js';

const AT_MS = Date.UTC(2026, 9, 6, 12);
const DEG = Math.PI / 180;

describe('homeOffsetKm (NASA Eyes #/home, Reference §4.5)', () => {
  it('sits 7.0 × 10⁸ km from the Sun, 25.0° above the ecliptic', () => {
    const out = homeOffsetKm(new Vector3(1.4e8, -3e7, 1e7), new Vector3(1.5e8, 0, 0), new Vector3());
    expect(out.length()).toBeCloseTo(HOME_DISTANCE_KM, -1);
    const elevationDeg = Math.asin(out.clone().normalize().dot(ECLIPTIC_NORTH_J2000)) / DEG;
    expect(elevationDeg).toBeCloseTo(25, 9);
  });

  it('keeps the camera’s ecliptic longitude around the Sun, so the view does not swing round', () => {
    const sun = new Vector3(1.5e8, 0, 0);
    const camera = new Vector3(1.5e8, 2e8, 0); // due ecliptic "y" of the Sun, near its plane
    const out = homeOffsetKm(camera, sun, new Vector3());
    const flat = out.clone().addScaledVector(ECLIPTIC_NORTH_J2000, -out.dot(ECLIPTIC_NORTH_J2000)).normalize();
    const was = camera.clone().sub(sun);
    const wasFlat = was.addScaledVector(ECLIPTIC_NORTH_J2000, -was.dot(ECLIPTIC_NORTH_J2000)).normalize();
    expect(flat.dot(wasFlat)).toBeCloseTo(1, 9);
  });
});

describe('bodyTarget', () => {
  it('gives the camera a body’s IAU pole and the Sun for its lit side', () => {
    const mars = bodyById('mars');
    if (!mars) throw new Error('no Mars');
    const target = bodyTarget(mars, { current: null });
    const p = iauPoleJ2000(499, new Date(AT_MS));
    const pole = target.poleJ2000(AT_MS, new Vector3());
    expect(pole.x).toBeCloseTo(p?.x ?? NaN, 12);
    expect(target.sunKm(AT_MS, new Vector3())).not.toBeNull(); // the analytic Sun, before the bake loads
    expect(target.positionKm(AT_MS, new Vector3())).toBeNull(); // but no Mars until it does
  });

  it('gives the Sun no lit side to swing to', () => {
    const sun = bodyById('sun');
    if (!sun) throw new Error('no Sun');
    expect(bodyTarget(sun, { current: null }).sunKm(AT_MS, new Vector3())).toBeNull();
  });
});
