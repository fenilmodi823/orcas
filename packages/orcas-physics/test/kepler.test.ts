import { describe, expect, it } from 'vitest';
import { GM_SUN, writeOsculatingEllipse } from '../src/index.js';

const at = (out: Float64Array, k: number) => ({ x: out[k * 3] ?? NaN, y: out[k * 3 + 1] ?? NaN, z: out[k * 3 + 2] ?? NaN });
const norm = (p: { x: number; y: number; z: number }) => Math.hypot(p.x, p.y, p.z);

describe('writeOsculatingEllipse', () => {
  // Mercury-like: perihelion 46.0e6 km, e = 0.2056, inclined 7° about x.
  const e = 0.2056;
  const q = 46.0e6;
  const a = q / (1 - e);
  const vPeri = Math.sqrt((GM_SUN * (1 + e)) / q);
  const inc = (7 * Math.PI) / 180;
  const r = { x: q, y: 0, z: 0 };
  const v = { x: 0, y: vPeri * Math.cos(inc), z: vPeri * Math.sin(inc) };
  const samples = 361;
  const out = new Float64Array(samples * 3);

  it('starts and ends at the body, so the line passes through it', () => {
    expect(writeOsculatingEllipse(r, v, GM_SUN, samples, out)).toBe(true);
    for (const k of [0, samples - 1]) {
      const p = at(out, k);
      expect(p.x).toBeCloseTo(r.x, 0);
      expect(p.y).toBeCloseTo(r.y, 0);
      expect(p.z).toBeCloseTo(r.z, 0);
    }
  });

  it('is the right conic: aphelion half-way round, and every sample on the ellipse', () => {
    writeOsculatingEllipse(r, v, GM_SUN, samples, out);
    expect(norm(at(out, (samples - 1) / 2)) / (a * (1 + e))).toBeCloseTo(1, 9);
    for (let k = 0; k < samples; k++) {
      const eccentricAnomaly = (2 * Math.PI * k) / (samples - 1); // starts at perihelion, E = 0
      expect(norm(at(out, k)) / (a * (1 - e * Math.cos(eccentricAnomaly)))).toBeCloseTo(1, 9);
    }
  });

  it('lies in the plane of r and v, and runs the way the body moves', () => {
    writeOsculatingEllipse(r, v, GM_SUN, samples, out);
    const h = { x: r.y * v.z - r.z * v.y, y: r.z * v.x - r.x * v.z, z: r.x * v.y - r.y * v.x };
    for (let k = 0; k < samples; k++) {
      const p = at(out, k);
      expect(Math.abs(p.x * h.x + p.y * h.y + p.z * h.z) / (norm(p) * norm(h))).toBeLessThan(1e-12);
    }
    const next = at(out, 1);
    expect((next.x - r.x) * v.x + (next.y - r.y) * v.y + (next.z - r.z) * v.z).toBeGreaterThan(0);
  });

  it('starts at the body from any point on the orbit, not just perihelion', () => {
    // Half a radian of eccentric anomaly past perihelion, state from the conic.
    const big = 0.5;
    const b = a * Math.sqrt(1 - e * e);
    const n = Math.sqrt(GM_SUN / a ** 3);
    const rate = n / (1 - e * Math.cos(big)); // dE/dt
    const rp = { x: a * (Math.cos(big) - e), y: b * Math.sin(big), z: 0 };
    const vp = { x: -a * Math.sin(big) * rate, y: b * Math.cos(big) * rate, z: 0 };
    writeOsculatingEllipse(rp, vp, GM_SUN, samples, out);
    const first = at(out, 0);
    expect(Math.hypot(first.x - rp.x, first.y - rp.y, first.z - rp.z)).toBeLessThan(1e-3);
    expect(norm(at(out, (samples - 1) / 2)) / (a * (1 - e * Math.cos(big + Math.PI)))).toBeCloseTo(1, 9);
  });

  it('handles a circular orbit, and refuses an unbound one', () => {
    const vCirc = Math.sqrt(GM_SUN / 1.496e8);
    expect(writeOsculatingEllipse({ x: 1.496e8, y: 0, z: 0 }, { x: 0, y: vCirc, z: 0 }, GM_SUN, samples, out)).toBe(true);
    expect(norm(at(out, 90)) / 1.496e8).toBeCloseTo(1, 9);
    const escape = { x: 0, y: vCirc * 1.5, z: 0 };
    expect(writeOsculatingEllipse({ x: 1.496e8, y: 0, z: 0 }, escape, GM_SUN, samples, out)).toBe(false);
  });
});
