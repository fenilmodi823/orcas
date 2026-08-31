import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { lvlhQuaternion } from './lvlh-pose.js';

/** Where the octahedron's long axis (+Y) ends up after the rotation. */
function longAxis(posKm: Vector3): Vector3 {
  return new Vector3(0, 1, 0).applyQuaternion(lvlhQuaternion(posKm, new Quaternion()));
}

describe('lvlhQuaternion', () => {
  it('points the long axis at Earth centre, from any position', () => {
    for (const p of [new Vector3(7000, 0, 0), new Vector3(0, 7000, 0),
                     new Vector3(0, 0, 7000), new Vector3(4000, -3000, 5000)]) {
      const nadir = p.clone().normalize().multiplyScalar(-1);
      expect(longAxis(p).dot(nadir)).toBeCloseTo(1, 6);
    }
  });

  it('produces a unit quaternion - a non-unit one would shear the mesh', () => {
    expect(lvlhQuaternion(new Vector3(4000, -3000, 5000), new Quaternion()).length())
      .toBeCloseTo(1, 12);
  });

  it('is continuous - a small position change makes a small rotation change', () => {
    const a = lvlhQuaternion(new Vector3(7000, 0, 0), new Quaternion());
    const b = lvlhQuaternion(new Vector3(7000, 1, 0), new Quaternion());
    expect(a.angleTo(b)).toBeLessThan(0.001);
  });

  it('does not produce NaN at the origin - the degenerate case', () => {
    const q = lvlhQuaternion(new Vector3(0, 0, 0), new Quaternion());
    expect(Number.isNaN(q.x + q.y + q.z + q.w)).toBe(false);
    expect(q.length()).toBeCloseTo(1, 12);
  });

  it('writes into out and returns it - zero allocation per frame', () => {
    const out = new Quaternion();
    expect(lvlhQuaternion(new Vector3(7000, 0, 0), out)).toBe(out);
  });
});
