import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { ECI_UP, lookRotation, refUpForFreeOrbit, refUpForObjectLvlh } from './look-rotation.js';

/** The camera's local axes after applying quaternion q. */
function axes(q: Quaternion) {
  return {
    right: new Vector3(1, 0, 0).applyQuaternion(q),
    up: new Vector3(0, 1, 0).applyQuaternion(q),
    forward: new Vector3(0, 0, -1).applyQuaternion(q),
  };
}

describe('lookRotation', () => {
  it('points -Z along `forward`', () => {
    const q = lookRotation(new Vector3(1, 0, 0), ECI_UP, ECI_UP.clone(), new Quaternion());
    expect(axes(q).forward.distanceTo(new Vector3(1, 0, 0))).toBeLessThan(1e-6);
  });

  it('keeps the horizon level: local X ⊥ refUp (no roll)', () => {
    const prevUp = ECI_UP.clone();
    for (const fwd of [new Vector3(1, 0, 0), new Vector3(0.3, 0.2, -1), new Vector3(-1, 0.5, 0.2)]) {
      const q = lookRotation(fwd.clone().normalize(), ECI_UP, prevUp, new Quaternion());
      expect(Math.abs(axes(q).right.dot(ECI_UP))).toBeLessThan(1e-6);
    }
  });

  it('does NOT produce NaN when looking straight along refUp — blends toward prevUp instead', () => {
    // Establish an off-pole prevUp by looking along a steep diagonal first.
    const prevUp = ECI_UP.clone();
    lookRotation(new Vector3(0, 1, 0.3).normalize(), ECI_UP, prevUp, new Quaternion());
    const before = prevUp.clone();
    // Now look straight up: the naive cross(f, refUp) vanishes.
    const q = lookRotation(new Vector3(0, 0, 1), ECI_UP, prevUp, new Quaternion());
    expect(Number.isNaN(q.x)).toBe(false);
    expect(q.length()).toBeCloseTo(1, 5);
    // the new up still carries prior-frame information (not orthogonal by
    // coincidence, not flipped) — the blend, not an arbitrary substitute axis
    expect(prevUp.dot(before)).toBeGreaterThan(0.2);
  });

  it('still returns a unit quaternion in the pathological case where prevUp is ALSO parallel to forward', () => {
    const prevUp = new Vector3(0, 0, 1); // parallel to the straight-up forward
    const q = lookRotation(new Vector3(0, 0, 1), ECI_UP, prevUp, new Quaternion());
    expect(Number.isNaN(q.x)).toBe(false);
    expect(q.length()).toBeCloseTo(1, 5);
  });

  it('renormalises: repeated application does not denormalise the quaternion', () => {
    const prevUp = ECI_UP.clone();
    let q = new Quaternion();
    for (let i = 0; i < 5000; i++) {
      q = lookRotation(new Vector3(Math.cos(i), Math.sin(i), 0.1).normalize(), ECI_UP, prevUp, q);
    }
    expect(q.length()).toBeCloseTo(1, 6);
  });
});

describe('reference up', () => {
  it('freeOrbit up is Earth\'s rotation axis', () => {
    expect(refUpForFreeOrbit(new Vector3()).equals(new Vector3(0, 0, 1))).toBe(true);
  });

  it('object LVLH up points away from Earth (radial)', () => {
    const up = refUpForObjectLvlh(new Vector3(7000, 0, 0), new Vector3());
    expect(up.distanceTo(new Vector3(1, 0, 0))).toBeLessThan(1e-6);
  });
});
