import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseHorizonsEphemeris } from '../../data/horizons-ephemeris.js';
import { createHorizonsIndex } from '../../data/horizons-index.js';
import { resetMoonSystems } from '../../data/moon-systems.js';
import { PLANETS } from './planets.js';
import { horizonsRelativeState } from './system-centres.js';
import { osculatingPeriodS, TRAIL_ALPHA, TRAIL_SAMPLES, writeMoonTrail, writeTrailColours } from './moon-trails.js';

const AT = Date.UTC(2026, 9, 12);
const MU_JUPITER = PLANETS.find((p) => p.name === 'Jupiter')?.gmKm3S2 ?? NaN;
const point = (a: Float64Array, i: number) => [a[i * 3] ?? NaN, a[i * 3 + 1] ?? NaN, a[i * 3 + 2] ?? NaN] as const;
const angleDeg = (p: readonly number[], q: readonly number[]) => {
  const dot = (p[0] ?? 0) * (q[0] ?? 0) + (p[1] ?? 0) * (q[1] ?? 0) + (p[2] ?? 0) * (q[2] ?? 0);
  return (Math.acos(Math.min(1, dot / (Math.hypot(...p) * Math.hypot(...q)))) * 180) / Math.PI;
};

beforeAll(() => {
  const f = readFileSync(resolve(process.cwd(), 'public/ephemeris/horizons/moons-jupiter.bin'));
  resetMoonSystems({ jupiter: createHorizonsIndex(parseHorizonsEphemeris(f.buffer.slice(f.byteOffset, f.byteOffset + f.byteLength))) });
});
afterAll(() => resetMoonSystems());

describe("a moon's trail (S6b, NASA's TrailComponent)", () => {
  it("takes one orbit as the osculating period: a circle's is 2π√(r³/μ)", () => {
    const mu = 1e5;
    const r = 1e4;
    expect(osculatingPeriodS([r, 0, 0, 0, Math.sqrt(mu / r), 0], mu)).toBeCloseTo(2 * Math.PI * Math.sqrt(r ** 3 / mu), 6);
  });

  it('gives Io 1.769254 days on 2026-10-12, from the export', () => {
    const s = new Float64Array(6);
    expect(horizonsRelativeState('jupiter', 501, AT, s)).toBe(5);
    expect(osculatingPeriodS(s, MU_JUPITER) / 86_400).toBeCloseTo(1.769254, 3);
  });

  it('ends at the moon and starts one orbit back, its points at most 2° apart', () => {
    const trail = new Float64Array(TRAIL_SAMPLES * 3);
    expect(writeMoonTrail('jupiter', 501, AT, MU_JUPITER, trail)).toBe(true);
    const now = new Float64Array(6);
    horizonsRelativeState('jupiter', 501, AT, now);
    const last = point(trail, TRAIL_SAMPLES - 1);
    expect(Math.hypot(last[0] - (now[0] ?? 0), last[1] - (now[1] ?? 0), last[2] - (now[2] ?? 0))).toBeLessThan(1e-6);
    const first = point(trail, 0);
    expect(Math.hypot(first[0] - last[0], first[1] - last[1], first[2] - last[2]) / Math.hypot(...last)).toBeLessThan(0.01);
    for (let i = 1; i < TRAIL_SAMPLES; i++) expect(angleDeg(point(trail, i - 1), point(trail, i))).toBeLessThan(2.05);
  });

  it("is shorter at the start of the export's data, never reaching before it", () => {
    const at = Date.UTC(1995, 10, 1, 12); // twelve hours into Io's 1995–2036 span
    const trail = new Float64Array(TRAIL_SAMPLES * 3);
    expect(writeMoonTrail('jupiter', 501, at, MU_JUPITER, trail)).toBe(true);
    let clamped = 0;
    while (clamped + 1 < TRAIL_SAMPLES && point(trail, clamped).every((v, k) => v === point(trail, clamped + 1)[k])) clamped += 1;
    expect(clamped).toBeGreaterThan(100); // about 129 of 180 steps fall before the data
  });

  it('has no trail where the moon has no data', () => {
    expect(writeMoonTrail('jupiter', 501, Date.UTC(1990, 0, 1), MU_JUPITER, new Float64Array(TRAIL_SAMPLES * 3))).toBe(false);
  });

  it('fades from nothing at the oldest point to its peak at the moon', () => {
    const colours = new Float32Array(TRAIL_SAMPLES * 4);
    writeTrailColours({ r: 0.2, g: 0.4, b: 0.6 }, TRAIL_ALPHA, colours);
    expect(colours[3]).toBe(0);
    expect(colours[(TRAIL_SAMPLES - 1) * 4 + 3]).toBeCloseTo(0.7, 6);
    expect(colours[90 * 4 + 3]).toBeCloseTo(0.35, 6);
  });
});
