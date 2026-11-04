// frontend/src/renderer/solar/spacecraft-trail.test.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GM_EARTH } from '@orcas/physics';
import { etSecondsFromUtcMs } from '../../data/planet-ephemeris.js';
import { parseHorizonsEphemeris } from '../../data/horizons-ephemeris.js';
import { createHorizonsIndex, type HorizonsIndex } from '../../data/horizons-index.js';
import { sheetDateEndUtcMs } from '../../data/horizons-manifest.js';
import {
  SEGMENT_FLOWN,
  SEGMENT_HIDDEN,
  SEGMENT_PREDICTED,
  SPACECRAFT_TRAIL_SAMPLES,
  centreGmKm3S2,
  writeSpacecraftTrail,
} from './spacecraft-trail.js';

const GM = 398_600.435507;
const R = 7000;
const W = Math.sqrt(GM / R ** 3);
function circular(switchAtEtS = Infinity): HorizonsIndex {
  return {
    targets: [-1],
    spans: () => [],
    stateInto(_t, etS, out) {
      out.set([R * Math.cos(W * etS), R * Math.sin(W * etS), 0, -R * W * Math.sin(W * etS), R * W * Math.cos(W * etS), 0]);
      return etS < switchAtEtS ? 399 : 0;
    },
  };
}
const NOW = Date.UTC(2026, 10, 4);
const out = new Float64Array(SPACECRAFT_TRAIL_SAMPLES * 3);
const kinds = new Uint8Array(SPACECRAFT_TRAIL_SAMPLES - 1);

describe('writeSpacecraftTrail', () => {
  it('spans one orbit about its centre, ending at the spacecraft', () => {
    expect(writeSpacecraftTrail(circular(), -1, NOW, Infinity, [], out, kinds)).toBe(399);
    const last = (SPACECRAFT_TRAIL_SAMPLES - 1) * 3;
    expect(Math.hypot(out[0]! - out[last]!, out[1]! - out[last + 1]!)).toBeLessThan(1e-3);
    expect([...kinds].every((k) => k === SEGMENT_FLOWN)).toBe(true);
  });
  it('dashes what comes after the flown date', () => {
    writeSpacecraftTrail(circular(), -1, NOW, NOW - 1000, [], out, kinds);
    expect(kinds.at(-1)).toBe(SEGMENT_PREDICTED);
    expect(kinds[0]).toBe(SEGMENT_FLOWN);
  });
  it('never draws across a change of centre', () => {
    const et = etSecondsFromUtcMs(NOW);
    const base = circular();
    const mixed: HorizonsIndex = { ...base, stateInto: (t, e, o) => { base.stateInto(t, e, o); return e < et - 1000 ? 0 : 399; } };
    writeSpacecraftTrail(mixed, -1, NOW, Infinity, [], out, kinds);
    expect(kinds[0]).toBe(SEGMENT_HIDDEN);
    expect(kinds.at(-1)).toBe(SEGMENT_FLOWN);
  });
  it('hides a segment that touches a jump', () => {
    const et = etSecondsFromUtcMs(NOW);
    writeSpacecraftTrail(circular(), -1, NOW, Infinity, [[et - 2000, et - 1500]], out, kinds);
    expect(kinds.includes(SEGMENT_HIDDEN)).toBe(true);
    expect(kinds.at(-1)).toBe(SEGMENT_FLOWN);
  });
  it('writes nothing where there is no data now', () => {
    const none: HorizonsIndex = { targets: [], spans: () => [], stateInto: () => null };
    out.fill(7);
    expect(writeSpacecraftTrail(none, -1, NOW, Infinity, [], out, kinds)).toBeNull();
    expect(out[0]).toBe(7);
  });
  it('hides both segments around a one-sample gap and nothing else', () => {
    const et = etSecondsFromUtcMs(NOW);
    const period = 2 * Math.PI / W;
    const gapEt = et - period * (1 - 90 / 180);
    const half = period / 180 / 2;
    const base = circular();
    const gappy: HorizonsIndex = { ...base, stateInto: (t, e, o) => (Math.abs(e - gapEt) < half ? null : base.stateInto(t, e, o)) };
    writeSpacecraftTrail(gappy, -1, NOW, Infinity, [], out, kinds);
    const hidden = [...kinds].flatMap((k, i) => (k === SEGMENT_HIDDEN ? [i] : []));
    expect(hidden).toEqual([89, 90]);
    expect(kinds.filter((k) => k === SEGMENT_FLOWN).length).toBe(kinds.length - 2);
  });
  it('maps centres to GM, null for the barycentre', () => {
    expect(centreGmKm3S2(399)).toBe(GM_EARTH);
    expect(centreGmKm3S2(0)).toBeNull();
  });
  it('real file: Voyager 1 cruise trail straddles its flown boundary', () => {
    const file = readFileSync(resolve(process.cwd(), 'public/ephemeris/horizons/spacecraft.bin'));
    const index = createHorizonsIndex(parseHorizonsEphemeris(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)));
    const boundary = sheetDateEndUtcMs('1992-04-24');
    expect(writeSpacecraftTrail(index, -31, Date.UTC(1993, 0, 1), boundary, [], out, kinds)).toBe(0);
    expect(kinds[0]).toBe(SEGMENT_FLOWN);
    expect(kinds.at(-1)).toBe(SEGMENT_PREDICTED);
  });
});
