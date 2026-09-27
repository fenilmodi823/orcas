import { describe, expect, it } from 'vitest';
import { Matrix4, SphereGeometry, Vector3 } from 'three';
import { eciToGeodeticDeg, gmstRad, sunDirectionJ2000, temeToJ2000Matrix, WGS84_A_KM } from '@orcas/physics';
import { earthOrientationMatrix } from './earth-orientation.js';

const AT = new Date('2026-03-20T12:00:00Z');

/** Scene J2000 → TEME (inverse precession), then the SGP4 path's own geodetic conversion. */
function geodeticOf(sceneKm: Vector3, at: Date) {
  const m = temeToJ2000Matrix(at).m;
  const teme = {
    x: m[0] * sceneKm.x + m[3] * sceneKm.y + m[6] * sceneKm.z,
    y: m[1] * sceneKm.x + m[4] * sceneKm.y + m[7] * sceneKm.z,
    z: m[2] * sceneKm.x + m[5] * sceneKm.y + m[8] * sceneKm.z,
  };
  return eciToGeodeticDeg(teme, gmstRad(at));
}

/** The sphere vertex at texture coordinate (u, v), as three builds it; u = null takes any. */
function vertexAtUv(u: number | null, v: number): Vector3 {
  const g = new SphereGeometry(1, 64, 32);
  const pos = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) {
    if ((u === null || Math.abs(uv.getX(i) - u) < 1e-9) && Math.abs(uv.getY(i) - v) < 1e-9) {
      return new Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    }
  }
  throw new Error(`no vertex at (${u}, ${v})`);
}

// An equirectangular map has longitude -180 at u = 0, 0 at u = 0.5, +90 at
// u = 0.75, and north at v = 1. These check the texture lands where the
// propagated objects say the ground is, using their geodetic conversion.
describe('earthOrientationMatrix', () => {
  const matrix = earthOrientationMatrix(AT, new Matrix4());

  it('puts the texture centre on the prime meridian at the equator', () => {
    const geo = geodeticOf(vertexAtUv(0.5, 0.5).applyMatrix4(matrix), AT);
    expect(geo.longitudeDeg).toBeCloseTo(0, 6);
    expect(geo.latitudeDeg).toBeCloseTo(0, 6);
    expect(geo.altitudeKm).toBeCloseTo(0, 6);
  });

  it('puts u = 0.75 at 90° east', () => {
    const geo = geodeticOf(vertexAtUv(0.75, 0.5).applyMatrix4(matrix), AT);
    expect(geo.longitudeDeg).toBeCloseTo(90, 6);
  });

  // three offsets the pole row's u by half a segment, so take any vertex on it.
  it('puts the top of the texture at the north pole', () => {
    const p = vertexAtUv(null, 1).applyMatrix4(matrix);
    expect(geodeticOf(p, AT).latitudeDeg).toBeCloseTo(90, 4);
  });

  it('scales to the WGS84 ellipsoid', () => {
    expect(vertexAtUv(0.5, 0.5).applyMatrix4(matrix).length()).toBeCloseTo(WGS84_A_KM, 6);
  });

  // An independent sanity check, not a fitted one: at noon UTC on the March
  // equinox the Sun is overhead near (0°, 0°) — off by the equation of time,
  // about 7 minutes, or ~2° of longitude.
  it('has the Sun overhead near Greenwich at noon UTC on the equinox', () => {
    const d = sunDirectionJ2000(AT);
    const sub = geodeticOf(new Vector3(d.x, d.y, d.z).multiplyScalar(WGS84_A_KM * 2), AT);
    expect(Math.abs(sub.latitudeDeg)).toBeLessThan(1);
    expect(Math.abs(sub.longitudeDeg)).toBeLessThan(5);
  });
});
