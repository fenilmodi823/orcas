import type { EciVec3 } from 'satellite.js';

type Vec = EciVec3<number>;

const TWO_PI = 2 * Math.PI;
/** Below this the periapsis direction is undefined; the body's own direction stands in. */
const CIRCULAR_E = 1e-10;

/**
 * The osculating two-body ellipse through a body's state, as `samples` points
 * from the body round to the body again (first and last coincide), evenly
 * spaced in **eccentric anomaly** (Phase-4 brief §F.6, Cosmic-Scales §3.3):
 * uniform time would crowd aphelion and starve perihelion. Runs in the
 * direction of motion. This is NASA Eyes' planet orbit line (Reference §4.3),
 * which samples true anomaly instead.
 *
 * Input: position (km) and velocity (km/s) relative to the central body, any
 * inertial frame, and μ = G(M + m) in km³/s². Output: km, same frame and
 * origin, into `out` (3 × samples). Returns false, writing nothing, if the
 * state is not on an ellipse.
 */
export function writeOsculatingEllipse(r: Vec, v: Vec, muKm3S2: number, samples: number, out: Float64Array): boolean {
  const rMag = Math.hypot(r.x, r.y, r.z);
  const v2 = v.x * v.x + v.y * v.y + v.z * v.z;
  const energy = v2 / 2 - muKm3S2 / rMag;
  if (!(energy < 0) || samples < 2 || out.length < samples * 3) return false;
  const a = -muKm3S2 / (2 * energy);

  // Angular momentum h = r × v, and the eccentricity vector (v × h)/μ − r̂.
  const hx = r.y * v.z - r.z * v.y;
  const hy = r.z * v.x - r.x * v.z;
  const hz = r.x * v.y - r.y * v.x;
  const hMag = Math.hypot(hx, hy, hz);
  const ex = (v.y * hz - v.z * hy) / muKm3S2 - r.x / rMag;
  const ey = (v.z * hx - v.x * hz) / muKm3S2 - r.y / rMag;
  const ez = (v.x * hy - v.y * hx) / muKm3S2 - r.z / rMag;
  const e = Math.hypot(ex, ey, ez);

  // Perifocal basis: P toward periapsis, Q = Ŵ × P (Ŵ along h).
  const circular = e < CIRCULAR_E;
  const px = circular ? r.x / rMag : ex / e;
  const py = circular ? r.y / rMag : ey / e;
  const pz = circular ? r.z / rMag : ez / e;
  const wx = hx / hMag;
  const wy = hy / hMag;
  const wz = hz / hMag;
  const qx = wy * pz - wz * py;
  const qy = wz * px - wx * pz;
  const qz = wx * py - wy * px;

  // The body's own eccentric anomaly: cos E = (1 − r/a)/e, sin E = r·v / (e√(μa)).
  const e0 = circular
    ? 0
    : Math.atan2((r.x * v.x + r.y * v.y + r.z * v.z) / (e * Math.sqrt(muKm3S2 * a)), (1 - rMag / a) / e);
  const b = a * Math.sqrt(1 - e * e);
  for (let k = 0; k < samples; k++) {
    const big = e0 + (TWO_PI * k) / (samples - 1);
    const xp = a * (Math.cos(big) - e);
    const yp = b * Math.sin(big);
    out[k * 3] = xp * px + yp * qx;
    out[k * 3 + 1] = xp * py + yp * qy;
    out[k * 3 + 2] = xp * pz + yp * qz;
  }
  return true;
}
