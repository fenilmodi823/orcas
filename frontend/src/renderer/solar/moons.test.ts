import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { iauPoleJ2000 } from '@orcas/physics';
import { parseHorizonsEphemeris, type HorizonsEphemeris } from '../../data/horizons-ephemeris.js';
import { createHorizonsIndex } from '../../data/horizons-index.js';
import { etSecondsFromUtcMs } from '../../data/planet-ephemeris.js';
import { MOON_SYSTEMS, type MoonSystemId } from '../../data/moon-systems.js';
import { parseHorizonsManifest } from '../../data/horizons-manifest.js';
import { PLANET_CREDIT } from './planets.js';
import { meanRadiusKm, MOONS, MOON_CREDIT, moonSystemOf, SYSTEM_RADIUS_KM } from './moons.js';

function load(system: MoonSystemId): HorizonsEphemeris {
  const file = readFileSync(resolve(process.cwd(), `public/ephemeris/horizons/moons-${system}.bin`));
  return parseHorizonsEphemeris(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
}
const files = Object.fromEntries(MOON_SYSTEMS.map((s) => [s, load(s)])) as Record<MoonSystemId, HorizonsEphemeris>;
const indexes = Object.fromEntries(MOON_SYSTEMS.map((s) => [s, createHorizonsIndex(files[s])])) as Record<MoonSystemId, ReturnType<typeof createHorizonsIndex>>;

describe('the major moons (S6b)', () => {
  it("are NASA Eyes' 19 for Mars to Neptune, with URL-safe ids", () => {
    expect(MOONS).toHaveLength(19);
    expect(new Set(MOONS.map((m) => m.id)).size).toBe(19);
    expect(MOONS.every((m) => /^[a-z]+$/.test(m.id))).toBe(true);
  });

  it('list their radii largest first, with the mean between', () => {
    for (const m of MOONS) {
      const [a, b, c] = m.radiiKm;
      expect(a >= b && b >= c, m.name).toBe(true);
      expect(meanRadiusKm(m)).toBeLessThanOrEqual(a);
      expect(meanRadiusKm(m)).toBeGreaterThanOrEqual(c);
    }
    expect(meanRadiusKm(MOONS.find((m) => m.id === 'phobos') ?? MOONS[0]!)).toBeCloseTo(Math.cbrt(13 * 11.4 * 9.1), 9);
  });

  it('all have data in the export on 2026-10-12', () => {
    const out = new Float64Array(6);
    const et = etSecondsFromUtcMs(Date.UTC(2026, 9, 12));
    for (const m of MOONS) expect(indexes[m.system].stateInto(m.naifId, et, out), m.name).not.toBeNull();
  });

  it("measure each system by its outermost moon's greatest distance in the export, rounded up", () => {
    for (const system of MOON_SYSTEMS) {
      let greatest = 0;
      for (const m of MOONS.filter((moon) => moon.system === system)) {
        for (const s of files[system].segments.get(m.naifId) ?? []) {
          for (let k = 0; k < s.states.length; k += 6) {
            greatest = Math.max(greatest, Math.hypot(s.states[k] ?? 0, s.states[k + 1] ?? 0, s.states[k + 2] ?? 0));
          }
        }
      }
      expect(SYSTEM_RADIUS_KM[system], system).toBeGreaterThanOrEqual(greatest);
      expect(SYSTEM_RADIUS_KM[system] - greatest, system).toBeLessThan(1);
    }
  });

  it("point their IAU poles along their orbit normals: Uranus's moons and Triton against them", () => {
    const out = new Float64Array(6);
    for (const iso of ['2020-06-01T00:00:00Z', '2026-10-12T00:00:00Z', '2036-06-01T00:00:00Z']) {
      const at = Date.parse(iso);
      for (const m of MOONS) {
        indexes[m.system].stateInto(m.naifId, etSecondsFromUtcMs(at), out);
        const [x = 0, y = 0, z = 0, vx = 0, vy = 0, vz = 0] = out;
        const h = [y * vz - z * vy, z * vx - x * vz, x * vy - y * vx];
        const hn = Math.hypot(h[0] ?? 0, h[1] ?? 0, h[2] ?? 0);
        const p = iauPoleJ2000(m.naifId, new Date(at));
        if (!p) throw new Error(`no pole for ${m.name}`);
        const cos = ((h[0] ?? 0) * p.x + (h[1] ?? 0) * p.y + (h[2] ?? 0) * p.z) / hn;
        const angle = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
        const against = m.system === 'uranus' || m.id === 'triton';
        expect(against ? angle > 90 : angle < 90, `${m.name} ${iso}`).toBe(true);
        expect(Math.min(angle, 180 - angle), `${m.name} ${iso}`).toBeLessThan(0.85); // worst measured: Tethys 0.777°
      }
    }
  });

  it("name a body's system: a moon's, or a planet's own", () => {
    expect(moonSystemOf('io')).toBe('jupiter');
    expect(moonSystemOf('jupiter')).toBe('jupiter');
    expect(moonSystemOf('earth')).toBeNull();
    expect(moonSystemOf(null)).toBeNull();
  });
});

describe('the credit line (S6b)', () => {
  it("dates the moons by the export's own manifest, and says where the giants' centres come from", () => {
    const manifest = parseHorizonsManifest(JSON.parse(readFileSync(resolve(process.cwd(), 'public/ephemeris/horizons/manifest.json'), 'utf8')) as unknown);
    expect(MOON_CREDIT).toContain(`exported ${manifest.exportedDate} UTC`);
    expect(PLANET_CREDIT).toContain('JPL Horizons');
  });
});
