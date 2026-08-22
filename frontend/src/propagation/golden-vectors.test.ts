import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { twoline2satrec } from 'satellite.js';
import { propagate } from '@orcas/physics';
import { parseSgp4VerFixture } from './parse-sgp4-ver-fixture.js';

const here = dirname(fileURLToPath(import.meta.url));
const tleText = readFileSync(join(here, 'fixtures/SGP4-VER.TLE'), 'utf-8');
const outText = readFileSync(join(here, 'fixtures/tcppver.out'), 'utf-8');
const allCases = parseSgp4VerFixture(tleText, outText);

// Clean near-earth cases only, per the fixture's own comments — see
// Step 2's note. Deep-space, decay, and known-quirk cases are excluded.
const SATNUMS_UNDER_TEST = [5, 6251, 88888];

const UNIX_EPOCH_JD = 2440587.5;

function epochToDate(jdsatepoch: number, tsinceMin: number): Date {
  const ms = (jdsatepoch - UNIX_EPOCH_JD) * 86_400_000 + tsinceMin * 60_000;
  return new Date(ms);
}

describe('propagate against Vallado SGP4-VER golden vectors', () => {
  const casesUnderTest = allCases.filter((c) => SATNUMS_UNDER_TEST.includes(c.satnum));

  it('loaded reference cases for all three satellites under test', () => {
    const satnumsFound = new Set(casesUnderTest.map((c) => c.satnum));
    expect([...satnumsFound].sort()).toEqual([5, 6251, 88888]);
    expect(casesUnderTest.length).toBeGreaterThan(20);
  });

  it.each(casesUnderTest)(
    'matches the Vallado reference for satnum $satnum at tsince=$tsinceMin min',
    (testCase) => {
      const satrec = twoline2satrec(testCase.line1, testCase.line2);
      const at = epochToDate(satrec.jdsatepoch, testCase.tsinceMin);
      const state = propagate(satrec, at, String(testCase.satnum));

      // Empirically measured, not guessed: across all 51 cases here
      // (checked with a throwaway script that runs every axis instead
      // of stopping at the first failing assertion), the real max diff
      // between satellite.js and Vallado's reference is 5.63m position /
      // 6.3mm/s velocity — satnum 88888, tsince=1440min (24h, ~16 full
      // orbits at this satellite's ~16/day mean motion), consistent
      // with accumulated floating-point-order differences between
      // independent conformant implementations, not a bug. Position
      // precision 1 (threshold 50m, ~9x margin) and velocity precision
      // 4 (threshold 5cm/s, ~8x margin) both clear the measured max
      // comfortably without being razor-thin.
      expect(state.positionEciKm.x).toBeCloseTo(testCase.positionKm.x, 1);
      expect(state.positionEciKm.y).toBeCloseTo(testCase.positionKm.y, 1);
      expect(state.positionEciKm.z).toBeCloseTo(testCase.positionKm.z, 1);
      expect(state.velocityEciKmS.x).toBeCloseTo(testCase.velocityKmS.x, 4);
      expect(state.velocityEciKmS.y).toBeCloseTo(testCase.velocityKmS.y, 4);
      expect(state.velocityEciKmS.z).toBeCloseTo(testCase.velocityKmS.z, 4);
    },
  );
});
