import { describe, expect, it } from 'vitest';
import { temeToJ2000Matrix, applyMat3 } from '../src/index.js';

function trace(m: { m: readonly number[] }): number {
  return m.m[0] + m.m[4] + m.m[8];
}

function transposeMultiply(m: { m: readonly number[] }): number[] {
  // M . M^T, should be the identity for a proper rotation matrix.
  const [a, b, c, d, e, f, g, h, i] = m.m;
  const rows = [
    [a, b, c],
    [d, e, f],
    [g, h, i],
  ];
  const out: number[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c2 = 0; c2 < 3; c2++) {
      out.push(rows[r][0] * rows[c2][0] + rows[r][1] * rows[c2][1] + rows[r][2] * rows[c2][2]);
    }
  }
  return out;
}

describe('temeToJ2000Matrix', () => {
  it('is exactly the identity at the J2000.0 epoch (T=0)', () => {
    const m = temeToJ2000Matrix(new Date('2000-01-01T12:00:00.000Z'));
    expect(m.m).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  it('is orthogonal (a proper rotation) at a real epoch', () => {
    const m = temeToJ2000Matrix(new Date('2026-08-22T00:00:00.000Z'));
    const mmT = transposeMultiply(m);
    const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    mmT.forEach((v, idx) => expect(v).toBeCloseTo(identity[idx], 10));
  });

  it('rotation magnitude matches the ~50.29 arcsec/year general precession rate', () => {
    // Independent cross-check: general precession in longitude is a
    // well-known constant (~50.2900 arcsec/year, IAU 1976). The rotation
    // angle recovered from trace(M) via the standard formula
    // angle = acos((trace - 1) / 2) should scale linearly with elapsed
    // time at roughly that rate. This substitutes for diffing against a
    // second SGP4/precession implementation, which isn't available in
    // this environment.
    const years = 26.5; // 2000-01-01 -> 2026-08-22, approx
    const m = temeToJ2000Matrix(new Date('2026-08-22T00:00:00.000Z'));
    const angleRad = Math.acos((trace(m) - 1) / 2);
    const expectedRadPerYear = (50.29 * Math.PI) / (180 * 3600);
    const expectedRad = expectedRadPerYear * years;
    expect(angleRad).toBeCloseTo(expectedRad, 2); // within ~0.01 rad (~34 arcmin)
  });

  it('applyMat3 rotates a unit vector without changing its length', () => {
    const m = temeToJ2000Matrix(new Date('2026-08-22T00:00:00.000Z'));
    const v = applyMat3(m, { x: 7000, y: 0, z: 0 });
    const length = Math.hypot(v.x, v.y, v.z);
    expect(length).toBeCloseTo(7000, 6);
  });
});
