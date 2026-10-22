// frontend/src/data/horizons-index.test.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  HorizonsEphemerisFormatError,
  horizonsStateAtEt,
  parseHorizonsEphemeris,
  type HorizonsEphemeris,
} from './horizons-ephemeris.js';
import { createHorizonsIndex } from './horizons-index.js';

const FILES = ['spacecraft', 'moons-mars', 'moons-jupiter', 'moons-saturn', 'moons-uranus', 'moons-neptune'];

// Vitest runs from frontend/, as horizons-ephemeris.test.ts does.
function load(name: string): HorizonsEphemeris {
  const file = readFileSync(resolve(process.cwd(), `public/ephemeris/horizons/${name}.bin`));
  return parseHorizonsEphemeris(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
}
/** ET seconds for a TDB label written as ISO, as the export's requests are. */
const etOf = (iso: string) => (Date.parse(iso) - Date.UTC(2000, 0, 1, 12)) / 1000;

/** A deterministic stream in [0, 1): the test must not depend on Math.random. */
function stream(seed: number): () => number {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1_664_525) + 1_013_904_223) >>> 0) / 2 ** 32;
}

describe('the Horizons time index (S6b)', () => {
  for (const [n, name] of FILES.entries()) {
    it(`answers exactly as the reader's linear scan does: ${name}`, () => {
      const ephemeris = load(name);
      const index = createHorizonsIndex(ephemeris);
      const random = stream(7919 * (n + 1));
      const out = new Float64Array(6);
      const lo = etOf('1972-01-01T00:00:00Z');
      const hi = etOf('2040-01-01T00:00:00Z');
      for (const target of index.targets) {
        const spans = index.spans(target);
        for (let k = 0; k < 300; k++) {
          // Half the probes inside the target's data, half anywhere, so "no data" is exercised too.
          const span = spans[Math.floor(random() * spans.length)];
          const et = k % 2 === 0 && span ? span[0] + random() * (span[1] - span[0]) : lo + random() * (hi - lo);
          const reference = horizonsStateAtEt(ephemeris, target, et);
          const centre = index.stateInto(target, et, out);
          if (!reference) {
            expect(centre, `NAIF ${target} at ET ${et}`).toBeNull();
            continue;
          }
          expect(centre).toBe(reference.centre);
          const { position: p, velocity: v } = reference;
          const r = Math.hypot(p.x, p.y, p.z) || 1;
          const s = Math.hypot(v.x, v.y, v.z) || 1;
          expect(Math.hypot((out[0] ?? NaN) - p.x, (out[1] ?? NaN) - p.y, (out[2] ?? NaN) - p.z) / r).toBeLessThan(1e-12);
          expect(Math.hypot((out[3] ?? NaN) - v.x, (out[4] ?? NaN) - v.y, (out[5] ?? NaN) - v.z) / s).toBeLessThan(1e-12);
        }
      }
    });
  }

  it("merges touching segments into the export's spans: Io has three", () => {
    const spans = createHorizonsIndex(load('moons-jupiter')).spans(501);
    const expected = [
      ['1973-11-14T00:00:00Z', '1974-12-23T00:00:00Z'],
      ['1979-02-14T00:00:00Z', '1979-07-30T00:00:00Z'],
      ['1995-11-01T00:00:00Z', '2036-12-31T00:00:00Z'],
    ];
    expect(spans).toHaveLength(3);
    spans.forEach(([start, end], i) => {
      expect(Math.abs(start - etOf(expected[i]?.[0] ?? ''))).toBeLessThan(1e-3);
      expect(Math.abs(end - etOf(expected[i]?.[1] ?? ''))).toBeLessThan(1e-3);
    });
  });

  it('has no data between spans, before the first or after the last', () => {
    const index = createHorizonsIndex(load('moons-jupiter'));
    const out = new Float64Array(6);
    for (const iso of ['1972-06-01T00:00:00Z', '1990-01-01T00:00:00Z', '2037-06-01T00:00:00Z']) {
      expect(index.stateInto(501, etOf(iso), out), iso).toBeNull();
    }
    expect(index.stateInto(-999, etOf('2026-10-12T00:00:00Z'), out)).toBeNull();
    expect(index.spans(-999)).toEqual([]);
  });

  it('refuses a window wider than its scratch holds, rather than truncate it silently', () => {
    const wide: HorizonsEphemeris = {
      segments: new Map([[501, [{ target: 501, centre: 5, firstEtS: 0, stepS: 60, window: 9, states: new Float32Array(6 * 12) }]]]),
    };
    expect(() => createHorizonsIndex(wide)).toThrow(HorizonsEphemerisFormatError);
  });
});
