import { Matrix4 } from 'three';
import { gmstRad, temeToJ2000Matrix, WGS84_A_KM, WGS84_B_KM } from '@orcas/physics';

const _precession = new Matrix4();
const _spin = new Matrix4();
// three's SphereGeometry has its pole on +Y and u = 0.5 on +X. Turning +Y to
// +Z puts the pole on the scene's spin axis and u = 0.5 (the texture's prime
// meridian) on Earth-fixed +X, so an equirectangular map lands unmodified.
const _poleToZ = new Matrix4().makeRotationX(Math.PI / 2);
// Unit sphere → WGS84 ellipsoid, in the sphere's own axes (pole = local Y).
const _ellipsoid = new Matrix4().makeScale(WGS84_A_KM, WGS84_B_KM, WGS84_A_KM);

/**
 * World matrix for a unit SphereGeometry drawn as the Earth at `at`:
 * ellipsoid scale, pole to +Z, spin by GMST (Earth-fixed → TEME), then
 * precession to J2000 — the scene frame. The same GMST and precession the
 * SGP4 path uses, so the texture and every propagated object agree on
 * where Greenwich is. Input: UTC Date. Output: `out`, km, J2000.
 */
export function earthOrientationMatrix(at: Date, out: Matrix4): Matrix4 {
  const m = temeToJ2000Matrix(at).m;
  _precession.set(m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1);
  _spin.makeRotationZ(gmstRad(at));
  return out.multiplyMatrices(_precession, _spin).multiply(_poleToZ).multiply(_ellipsoid);
}
