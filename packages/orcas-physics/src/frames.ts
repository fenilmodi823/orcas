import type { EciVec3 } from 'satellite.js';

const ARCSEC_TO_RAD = Math.PI / (180 * 3600);
const J2000_JD = 2451545.0;
const UNIX_EPOCH_JD = 2440587.5;
const DAYS_PER_JULIAN_CENTURY = 36525;

/** A 3x3 rotation matrix, row-major: [m00,m01,m02, m10,m11,m12, m20,m21,m22]. */
export interface Mat3 {
  readonly m: readonly [
    number, number, number,
    number, number, number,
    number, number, number,
  ];
}

function rotZ(angleRad: number): Mat3 {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return { m: [c, s, 0, -s, c, 0, 0, 0, 1] };
}

function rotY(angleRad: number): Mat3 {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return { m: [c, 0, -s, 0, 1, 0, s, 0, c] };
}

function multiply(a: Mat3, b: Mat3): Mat3 {
  const [a11, a12, a13, a21, a22, a23, a31, a32, a33] = a.m;
  const [b11, b12, b13, b21, b22, b23, b31, b32, b33] = b.m;
  return {
    m: [
      a11 * b11 + a12 * b21 + a13 * b31,
      a11 * b12 + a12 * b22 + a13 * b32,
      a11 * b13 + a12 * b23 + a13 * b33,
      a21 * b11 + a22 * b21 + a23 * b31,
      a21 * b12 + a22 * b22 + a23 * b32,
      a21 * b13 + a22 * b23 + a23 * b33,
      a31 * b11 + a32 * b21 + a33 * b31,
      a31 * b12 + a32 * b22 + a33 * b32,
      a31 * b13 + a32 * b23 + a33 * b33,
    ],
  };
}

/** Apply a rotation matrix to a vector. Input/output units match the vector's. */
export function applyMat3(matrix: Mat3, v: EciVec3<number>): EciVec3<number> {
  const [m11, m12, m13, m21, m22, m23, m31, m32, m33] = matrix.m;
  return {
    x: m11 * v.x + m12 * v.y + m13 * v.z,
    y: m21 * v.x + m22 * v.y + m23 * v.z,
    z: m31 * v.x + m32 * v.y + m33 * v.z,
  };
}

/**
 * Julian centuries of TT elapsed since J2000.0, approximating TT with UTC.
 * The TT-UTC offset (~69s in 2026) shifts T by roughly 2e-8 centuries —
 * far below the arcsecond-level precision this rotation targets, so the
 * approximation is deliberate, not an oversight. Input: UTC Date.
 */
function julianCenturiesTT(at: Date): number {
  const jd = at.getTime() / 86_400_000 + UNIX_EPOCH_JD;
  return (jd - J2000_JD) / DAYS_PER_JULIAN_CENTURY;
}

/**
 * IAU 1976 (Lieske) precession-only rotation from the mean equator and
 * equinox of date to J2000. Nutation (arcsecond-level, sub-100m at LEO)
 * is not modelled — see ORCAS Vault Phase-4 Engineering Brief §A.5,
 * "Frames of reference": the TEME-to-true-J2000/GCRF gap this leaves
 * uncorrected is three orders of magnitude below SGP4's own ~1km epoch
 * error, so it is free precision, not a claim of exactness. Input: UTC
 * Date. Output: a rotation matrix — apply with applyMat3 to a
 * TEME-frame vector to get an approximate-J2000 one.
 *
 * Derivation: precession from J2000 to date is P = R3(-z).R2(theta).R3(-zeta)
 * (Vallado, Fundamentals of Astrodynamics and Applications). This
 * function returns its inverse (date to J2000), P^T = R3(zeta).R2(-theta).R3(z),
 * via the standard IAU 1976 precession angles (arcsec, T = Julian
 * centuries TT from J2000):
 *   zeta  = 2306.2181 T + 0.30188 T^2 + 0.017998 T^3
 *   z     = 2306.2181 T + 1.09468 T^2 + 0.018203 T^3
 *   theta = 2004.3109 T - 0.42665 T^2 - 0.041833 T^3
 */
export function temeToJ2000Matrix(at: Date): Mat3 {
  const t = julianCenturiesTT(at);
  const zeta = (2306.2181 * t + 0.30188 * t ** 2 + 0.017998 * t ** 3) * ARCSEC_TO_RAD;
  const z = (2306.2181 * t + 1.09468 * t ** 2 + 0.018203 * t ** 3) * ARCSEC_TO_RAD;
  const theta = (2004.3109 * t - 0.42665 * t ** 2 - 0.041833 * t ** 3) * ARCSEC_TO_RAD;

  return multiply(rotZ(zeta), multiply(rotY(-theta), rotZ(z)));
}
