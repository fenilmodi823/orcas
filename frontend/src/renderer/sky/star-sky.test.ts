import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseStarSky, normalisedBrightness, StarSkyFormatError } from './star-sky.js';

const HEADER_BYTES = 28;
const RECORD_BYTES = 10;

interface FakeStar {
  raDeg: number;
  decDeg: number;
  magByte: number;
  colourByte: number;
}

/** Build a buffer in exactly the layout fetch_gaia_sky.py writes. */
function packSky(stars: FakeStar[], magMin = 2, magMax = 9, colourMin = -0.6, colourMax = 5): ArrayBuffer {
  const buffer = new ArrayBuffer(HEADER_BYTES + stars.length * RECORD_BYTES);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < 8; i++) bytes[i] = 'ORCASKY1'.charCodeAt(i);
  view.setUint32(8, stars.length, true);
  view.setFloat32(12, magMin, true);
  view.setFloat32(16, magMax, true);
  view.setFloat32(20, colourMin, true);
  view.setFloat32(24, colourMax, true);
  stars.forEach((star, i) => {
    const at = HEADER_BYTES + i * RECORD_BYTES;
    view.setFloat32(at, star.raDeg, true);
    view.setFloat32(at + 4, star.decDeg, true);
    view.setUint8(at + 8, star.magByte);
    view.setUint8(at + 9, star.colourByte);
  });
  return buffer;
}

describe('parseStarSky', () => {
  // RA/Dec -> ECI axes. Getting any of these wrong mirrors or rolls the
  // whole sky, which is exactly the kind of error that looks plausible.
  it('puts the equinox on +X, six hours of RA on +Y and the pole on +Z', () => {
    const sky = parseStarSky(
      packSky([
        { raDeg: 0, decDeg: 0, magByte: 254, colourByte: 100 },
        { raDeg: 90, decDeg: 0, magByte: 254, colourByte: 100 },
        { raDeg: 0, decDeg: 90, magByte: 254, colourByte: 100 },
      ]),
    );
    expect([...sky.directions.slice(0, 3)].map((v) => Math.round(v))).toEqual([1, 0, 0]);
    expect([...sky.directions.slice(3, 6)].map((v) => Math.round(v))).toEqual([0, 1, 0]);
    expect([...sky.directions.slice(6, 9)].map((v) => Math.round(v))).toEqual([0, 0, 1]);
  });

  it('recovers the real magnitude from the quantised byte', () => {
    const sky = parseStarSky(packSky([{ raDeg: 10, decDeg: 20, magByte: 0, colourByte: 0 }], 2, 9));
    expect(sky.magnitudes[0]).toBeCloseTo(2, 5); // byte 0 is the brightest end
  });

  // A source with no bp_rp must survive as "unknown colour", not vanish and
  // not silently become blue — dropping them would bias the sky against the
  // reddest objects.
  it('marks a missing bp_rp as NaN rather than dropping the star', () => {
    const sky = parseStarSky(packSky([{ raDeg: 0, decDeg: 0, magByte: 128, colourByte: 255 }]));
    expect(sky.count).toBe(1);
    expect(Number.isNaN(sky.colourIndices[0])).toBe(true);
  });

  it('refuses a file that is not ours', () => {
    const buffer = packSky([]);
    new Uint8Array(buffer)[0] = 'X'.charCodeAt(0);
    expect(() => parseStarSky(buffer)).toThrow(StarSkyFormatError);
  });

  // A truncated download must fail loudly. Half a sky rendered without
  // complaint is indistinguishable from a fabricated one.
  it('refuses a truncated file rather than rendering part of a sky', () => {
    const full = packSky([
      { raDeg: 0, decDeg: 0, magByte: 1, colourByte: 1 },
      { raDeg: 1, decDeg: 1, magByte: 1, colourByte: 1 },
    ]);
    expect(() => parseStarSky(full.slice(0, full.byteLength - 3))).toThrow(StarSkyFormatError);
  });
});

describe('normalisedBrightness', () => {
  it('is 1 at the brightest star and 0 at the cut', () => {
    expect(normalisedBrightness(1.7, 1.7, 9)).toBe(1);
    expect(normalisedBrightness(9, 1.7, 9)).toBe(0);
  });
});

/**
 * Validates the artefact that actually ships, not a fixture. If
 * fetch_gaia_sky.py is re-run with a different cut this still passes; if the
 * file is corrupt, truncated, or replaced by something that is not a real
 * Gaia extract, it fails.
 */
describe('the shipped Gaia DR3 sky', () => {
  // cwd, not import.meta.url: under the jsdom environment import.meta.url
  // is an http: URL and fileURLToPath rejects it. Vitest runs from frontend/.
  const path = resolve(process.cwd(), 'public/sky/gaia-dr3-stars.bin');
  const file = readFileSync(path);
  const sky = parseStarSky(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer);

  it('carries a substantial all-sky set', () => {
    expect(sky.count).toBeGreaterThan(50_000);
  });

  it('has every direction on the unit sphere', () => {
    for (let i = 0; i < sky.count; i += 997) {
      const x = sky.directions[i * 3];
      const y = sky.directions[i * 3 + 1];
      const z = sky.directions[i * 3 + 2];
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 5);
    }
  });

  // Gaia saturates near G = 3, so the brightest naked-eye stars are absent.
  // Pinned deliberately: this is a real limit of the mission and the day it
  // changes is a day the sky's provenance changed.
  it('starts at the Gaia bright limit, not at Sirius', () => {
    expect(sky.magMin).toBeGreaterThan(0);
    expect(sky.magMax).toBeLessThanOrEqual(11);
  });

  // Real stars are not uniform on the sky: the galactic plane holds far more
  // of them. If this ever came out flat, the file would not be a real sky.
  it('shows the Milky Way — density concentrated toward the galactic plane', () => {
    // Galactic north pole, ICRS: RA 192.86 deg, Dec 27.13 deg.
    const gpRa = (192.85948 * Math.PI) / 180;
    const gpDec = (27.12825 * Math.PI) / 180;
    const px = Math.cos(gpDec) * Math.cos(gpRa);
    const py = Math.cos(gpDec) * Math.sin(gpRa);
    const pz = Math.sin(gpDec);

    let nearPlane = 0;
    let nearPoles = 0;
    for (let i = 0; i < sky.count; i++) {
      // |sin(galactic latitude)| = |direction . galactic pole|
      const sinB = Math.abs(
        sky.directions[i * 3] * px + sky.directions[i * 3 + 1] * py + sky.directions[i * 3 + 2] * pz,
      );
      if (sinB < 0.17) nearPlane++; // |b| < ~10 deg
      else if (sinB > 0.87) nearPoles++; // |b| > ~60 deg
    }
    // Equal solid angles would give roughly equal counts. The plane wins by
    // a wide margin in any real catalogue.
    expect(nearPlane).toBeGreaterThan(nearPoles * 3);
  });
});
