import { describe, expect, it } from 'vitest';
import { temeToJ2000Matrix, applyMat3, type Mat3 } from '../src/index.js';

function trace(m: Mat3): number {
  return m.m[0] + m.m[4] + m.m[8];
}

function transposeMultiply(m: Mat3): number[] {
  // M . M^T, should be the identity for a proper rotation matrix.
  const [a, b, c, d, e, f, g, h, i] = m.m;
  const rows: readonly (readonly [number, number, number])[] = [
    [a, b, c],
    [d, e, f],
    [g, h, i],
  ];
  const out: number[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c2 = 0; c2 < 3; c2++) {
      const [r0, r1, r2] = rows[r] ?? [NaN, NaN, NaN];
      const [c0, c1, c3] = rows[c2] ?? [NaN, NaN, NaN];
      out.push(r0 * c0 + r1 * c1 + r2 * c3);
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
    mmT.forEach((v, idx) => expect(v).toBeCloseTo(identity[idx] ?? NaN, 10));
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
