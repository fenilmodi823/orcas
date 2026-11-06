// frontend/src/renderer/solar/spacecraft-path.test.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseHorizonsEphemeris } from '../../data/horizons-ephemeris.js';
import { createHorizonsIndex, type HorizonsIndex, type Span } from '../../data/horizons-index.js';
import { SEGMENT_FLOWN, SEGMENT_HIDDEN, SEGMENT_PREDICTED } from './spacecraft-trail.js';
import { MISSION_PATH_MAX_POINTS, writeMissionPath } from './spacecraft-path.js';
import { etSecondsFromUtcMs } from '../../data/planet-ephemeris.js';
import { flownBoundary, jumpSpans, parseHorizonsManifest } from '../../data/horizons-manifest.js';

const GM = 398_600.435507;
const R = 7000;
const W = Math.sqrt(GM / R ** 3);
const E0 = 1e8;
const PERIOD = (2 * Math.PI) / W;
function circular(spans: readonly Span[], centre = 399): HorizonsIndex {
  return {
    targets: [-1],
    spans: () => spans,
    stateInto(_t, etS, out) {
      out.set([R * Math.cos(W * etS), R * Math.sin(W * etS), 0, 0, 0, 0]);
      return centre;
    },
  };
}
const out = new Float64Array(MISSION_PATH_MAX_POINTS * 3);
const kinds = new Uint8Array(MISSION_PATH_MAX_POINTS - 1);

describe('writeMissionPath', () => {
  it('samples the whole span about its centre', () => {
    const n = writeMissionPath(circular([[E0, E0 + 10 * PERIOD]]), -1, 399, Infinity, [], out, kinds);
    expect(n).toBe(MISSION_PATH_MAX_POINTS);
    for (let i = 0; i < n; i++) expect(Math.abs(Math.hypot(out[i * 3]!, out[i * 3 + 1]!) - R)).toBeLessThan(1);
    expect([...kinds.subarray(0, n - 1)].every((k) => k === SEGMENT_FLOWN)).toBe(true);
  });
  it('writes nothing where no sample has the centre', () => {
    out.fill(7);
    expect(writeMissionPath(circular([[E0, E0 + PERIOD]]), -1, 0, Infinity, [], out, kinds)).toBe(0);
    expect(out[0]).toBe(7);
  });
  it('hides the segment between two spans', () => {
    const n = writeMissionPath(circular([[E0, E0 + PERIOD], [E0 + 3 * PERIOD, E0 + 5 * PERIOD]]), -1, 399, Infinity, [], out, kinds);
    expect(n).toBe(MISSION_PATH_MAX_POINTS);
    const hidden = [...kinds.subarray(0, n - 1)].flatMap((k, i) => (k === SEGMENT_HIDDEN ? [i] : []));
    expect(hidden).toEqual([Math.round((MISSION_PATH_MAX_POINTS * 1) / 3) - 1]);
  });
  it('hides a jump and dashes what is after the flown date', () => {
    const spans: Span[] = [[E0, E0 + 10 * PERIOD]];
    const mid = E0 + 5 * PERIOD;
    // flown date in UTC ms: the ET of `mid` is E0 + 5 periods; ET s past J2000 -> UTC ms
    const flownUtcMs = Date.UTC(2000, 0, 1, 12) + mid * 1000;
    const n = writeMissionPath(circular(spans), -1, 399, flownUtcMs, [[mid + 100, mid + 200]], out, kinds);
    expect(kinds[0]).toBe(SEGMENT_FLOWN);
    expect(kinds[n - 2]).toBe(SEGMENT_PREDICTED);
    expect(kinds.subarray(0, n - 1).includes(SEGMENT_HIDDEN)).toBe(true);
  });
  it('keeps 2+ points in every span when many short spans follow a long one', () => {
    const spans: Span[] = [[E0, E0 + 10_000 * PERIOD]];
    for (let i = 0; i < 100; i++) spans.push([E0 + (10_001 + 2 * i) * PERIOD, E0 + (10_002 + 2 * i) * PERIOD]);
    out.fill(0);
    // About the barycentre (no μ), so the 10,000-orbit span's sparse samples are not hidden as chords.
    const n = writeMissionPath(circular(spans, 0), -1, 0, Infinity, [], out, kinds);
    expect(n).toBeLessThanOrEqual(MISSION_PATH_MAX_POINTS);
    expect(n).toBeGreaterThanOrEqual(2 * spans.length);
    for (let i = 0; i < n * 3; i++) expect(Number.isNaN(out[i])).toBe(false);
    // 100 hidden joins plus the segments nobody could draw: every short span shows at least one visible segment
    expect([...kinds.subarray(0, n - 1)].filter((k) => k === SEGMENT_HIDDEN).length).toBe(spans.length - 1);
  });
  it('real file: Juno about Jupiter, its cruise hidden', () => {
    const file = readFileSync(resolve(process.cwd(), 'public/ephemeris/horizons/spacecraft.bin'));
    const index = createHorizonsIndex(parseHorizonsEphemeris(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)));
    const n = writeMissionPath(index, -61, 5, Infinity, [], out, kinds);
    expect(n).toBeGreaterThan(2);
    expect(kinds[0]).toBe(SEGMENT_HIDDEN);
    // One span, so point i is at a + (b - a) * i / (n - 1). Juno joins Jupiter's frame on 2016-06-01, on the
    // approach, 2.2e7 km out (the brief's 1e7 km holds only once in orbit, after arrival on 2016-07-05).
    const [a, b] = index.spans(-61)[0]!;
    const etAt = (i: number) => a + ((b - a) * i) / (n - 1);
    const ARRIVAL_ET_S = (Date.UTC(2016, 6, 6) - Date.UTC(2000, 0, 1, 12)) / 1000;
    let visible = 0;
    for (let i = 0; i < n - 1; i++) {
      if (etAt(i) < 518_073_599 - 86_400) expect(kinds[i]).toBe(SEGMENT_HIDDEN);
      if (kinds[i] === SEGMENT_HIDDEN) continue;
      visible++;
      for (const p of [i, i + 1]) {
        const d = Math.hypot(out[p * 3]!, out[p * 3 + 1]!, out[p * 3 + 2]!);
        expect(d).toBeLessThan(2.5e7);
        if (etAt(p) > ARRIVAL_ET_S) expect(d).toBeLessThan(1e7);
      }
    }
    expect(visible).toBeGreaterThan(0);
  });
  it('real file: LRO about the Moon draws no chords (a sample every 86 min against a 2 h orbit)', () => {
    const file = readFileSync(resolve(process.cwd(), 'public/ephemeris/horizons/spacecraft.bin'));
    const index = createHorizonsIndex(parseHorizonsEphemeris(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)));
    const n = writeMissionPath(index, -85, 301, Infinity, [], out, kinds);
    expect(n).toBeGreaterThan(2);
    // Visible is only the 2009 approach, 162,639 km out and beyond; the 1,800 km mapping orbit draws nothing.
    for (let i = 0; i < n - 1; i++) {
      if (kinds[i] !== SEGMENT_HIDDEN) expect(Math.hypot(out[i * 3]!, out[i * 3 + 1]!, out[i * 3 + 2]!)).toBeGreaterThan(1e5);
    }
  });
  it('real file: Artemis II about the Earth, flown, its jump hidden (the live clock cannot reach April 2026)', () => {
    const file = readFileSync(resolve(process.cwd(), 'public/ephemeris/horizons/spacecraft.bin'));
    const index = createHorizonsIndex(parseHorizonsEphemeris(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)));
    const manifest = parseHorizonsManifest(JSON.parse(readFileSync(resolve(process.cwd(), 'public/ephemeris/horizons/manifest.json'), 'utf8')) as unknown);
    const s = new Float64Array(6);
    expect(index.stateInto(-1024, etSecondsFromUtcMs(Date.UTC(2026, 3, 6, 23)), s)).toBe(399);
    // The plan measured 413,123 km at the nearest keyframe; 23:00 itself is interpolated.
    expect(Math.hypot(s[0]!, s[1]!, s[2]!)).toBeCloseTo(413_123, -4);
    const jumps = jumpSpans(manifest, -1024);
    const n = writeMissionPath(index, -1024, 399, flownBoundary(manifest, -1024).utcMs, jumps, out, kinds);
    expect(n).toBeGreaterThan(2);
    const [jumpStart, jumpEnd] = jumps[0]!;
    const etAt = (i: number) => {
      let k = i;
      for (const [a, b] of index.spans(-1024)) {
        const c = Math.max(2, Math.round((MISSION_PATH_MAX_POINTS * (b - a)) / index.spans(-1024).reduce((t, [x, y]) => t + y - x, 0)));
        if (k < c) return a + ((b - a) * k) / (c - 1);
        k -= c;
      }
      return NaN;
    };
    for (let i = 0; i < n - 1; i++) {
      expect(kinds[i]).not.toBe(SEGMENT_PREDICTED);
      if (etAt(i) < jumpEnd && etAt(i + 1) > jumpStart) expect(kinds[i]).toBe(SEGMENT_HIDDEN);
    }
    expect([...kinds.subarray(0, n - 1)].filter((k) => k === SEGMENT_FLOWN).length).toBeGreaterThan(0);
  });
});
