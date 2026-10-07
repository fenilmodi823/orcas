import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import fixture from './fixtures/horizons-samples.json' with { type: 'json' };
import {
  horizonsStateAtEt,
  horizonsStateKm,
  HorizonsEphemerisFormatError,
  parseHorizonsEphemeris,
  segmentStateKm,
  type HorizonsEphemeris,
} from './horizons-ephemeris.js';

const FILES = ['spacecraft', 'moons-mars', 'moons-jupiter', 'moons-saturn', 'moons-uranus', 'moons-neptune'];

// Vitest runs from frontend/ (see star-sky.test.ts for why not import.meta.url).
function load(name: string): HorizonsEphemeris {
  const file = readFileSync(resolve(process.cwd(), `public/ephemeris/horizons/${name}.bin`));
  return parseHorizonsEphemeris(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
}
const baked = FILES.map(load);
const segmentsOf = (target: number) => baked.flatMap((e) => e.segments.get(target) ?? []);
const spacecraft = baked[0]!;
const etOf = (iso: string) => (Date.parse(iso) - Date.UTC(2000, 0, 1, 12)) / 1000;

describe('the baked Horizons trajectories (S6a)', () => {
  // The bake keeps a sample only if the curve misses it by more than 1/10,000 of
  // the distance from the centre; these are samples it dropped, checked through
  // the client's own reader and float32 keyframes.
  it(`passes within ${fixture.maxRelativeError} of the distance at all ${fixture.samples.length} dropped samples`, () => {
    let worst = 0;
    for (const sample of fixture.samples) {
      const segment = segmentsOf(sample.target).find((s) => s.centre === sample.centre && segmentStateKm(s, sample.et));
      expect(segment, `${sample.target} @${sample.centre} at ET ${sample.et}`).toBeDefined();
      const { position } = segmentStateKm(segment!, sample.et)!;
      const [x = NaN, y = NaN, z = NaN] = sample.positionKm;
      const relative = Math.hypot(position.x - x, position.y - y, position.z - z) / sample.scaleKm;
      worst = Math.max(worst, relative);
    }
    expect(worst).toBeLessThanOrEqual(fixture.maxRelativeError);
  });

  it('carries all 25 spacecraft and the 19 moons and 4 planet centres', () => {
    expect(spacecraft.segments.size).toBe(25);
    const natural = new Set(baked.slice(1).flatMap((e) => [...e.segments.keys()]));
    expect(natural.size).toBe(23);
  });

  it('uses the finest series that covers an instant: Voyager 1 at Jupiter is Jupiter-centred', () => {
    expect(horizonsStateKm(spacecraft, -31, Date.parse('1979-03-05T12:00:00Z'))?.centre).toBe(5);
    expect(horizonsStateKm(spacecraft, -31, Date.parse('1985-01-01T00:00:00Z'))?.centre).toBe(0);
  });

  it('has no state before launch or past the end of the export', () => {
    expect(horizonsStateAtEt(spacecraft, -31, etOf('1977-09-01T00:00:00Z'))).toBeNull();
    expect(horizonsStateAtEt(spacecraft, -82, etOf('2017-09-16T00:00:00Z'))).toBeNull();
  });

  it('gives a velocity consistent with the change in position', () => {
    const t = etOf('2026-06-01T00:00:00Z');
    const now = horizonsStateAtEt(spacecraft, -85, t)!;
    const later = horizonsStateAtEt(spacecraft, -85, t + 1)!;
    expect(now.centre).toBe(301);
    expect(later.position.x - now.position.x).toBeCloseTo(now.velocity.x, 2);
  });

  it('rejects a file that is not a Horizons bake', () => {
    expect(() => parseHorizonsEphemeris(new ArrayBuffer(4))).toThrow(HorizonsEphemerisFormatError);
    expect(() => parseHorizonsEphemeris(new TextEncoder().encode('ORCASPL1\0\0\0\0').buffer)).toThrow(/magic/);
  });
});
