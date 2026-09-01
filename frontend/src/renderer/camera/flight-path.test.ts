import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import {
  angleBetweenDirs,
  APPROACH_BLEND,
  flightDurationSec,
  sampleFlightPath,
  type FlightEndpoint,
  type FlightSample,
} from './flight-path.js';

const emptySample = (): FlightSample => ({
  positionKm: new Vector3(),
  pivotKm: new Vector3(),
  refUp: new Vector3(),
});

describe('flightDurationSec', () => {
  // ⚠️ DEVIATION from brief §C.6's worked example, made 2026-09-01 with the
  // approach blend. The brief's 0.075 s/octave gives ~2.0 s here; this uses
  // 0.1, giving ~2.4 s. The extra 0.4 s is spent entirely inside the part of
  // the flight where the object is close enough to have a visible size —
  // measured, the watchable window went 729 ms → 1355 ms. Lengthening the
  // flight was only worth doing once the blend put that time somewhere with
  // something to look at; on its own it just made the empty traverse longer.
  it('Earth→ISS (40,000 km → 0.45 km, ~72° swing) is ~2.4 s: 0.55 + 0.1·16.4 + 0.55·0.4', () => {
    const theta = (72 * Math.PI) / 180; // θ/π = 0.4, as the brief's example assumes
    expect(flightDurationSec(40000, 0.45, theta)).toBeCloseTo(2.4, 1);
  });

  it('a hop between two neighbouring satellites (both framed at ~0.5 km) sits at the 1.2 s floor', () => {
    const d = flightDurationSec(0.5, 0.5, 2.0);
    expect(d).toBeGreaterThanOrEqual(1.2);
    expect(d).toBeLessThan(1.4);
  });

  it('grows with the LOG of distance — a million-fold zoom is ~2x a ten-fold one, not 100,000x', () => {
    const tenFold = flightDurationSec(10, 1, 0);
    const millionFold = flightDurationSec(1_000_000, 1, 0);
    expect(millionFold / tenFold).toBeLessThan(2.5);
  });

  it('is clamped to [1.2, 3.4] s — no flight is instant, none is a wait', () => {
    expect(flightDurationSec(1, 1, 0)).toBeGreaterThanOrEqual(1.2);
    expect(flightDurationSec(1e12, 1, Math.PI)).toBeLessThanOrEqual(3.4);
  });
});

describe('sampleFlightPath', () => {
  const from: FlightEndpoint = {
    dir: new Vector3(0, 0, 1),
    radiusKm: 40000,
    pivotKm: new Vector3(0, 0, 0),
    refUp: new Vector3(0, 0, 1),
  };
  const to: FlightEndpoint = {
    dir: new Vector3(1, 0, 0),
    radiusKm: 0.45,
    pivotKm: new Vector3(7000, 0, 0),
    refUp: new Vector3(1, 0, 0),
  };

  it('at u=0 the sample is exactly the `from` pose', () => {
    const s = sampleFlightPath(from, to, 0, to.pivotKm, 0, emptySample());
    expect(s.positionKm.distanceTo(new Vector3(0, 0, 40000))).toBeLessThan(1e-3);
  });

  it('at u=1 the sample is exactly the `to` pose (pivot = estimate)', () => {
    const s = sampleFlightPath(from, to, 1, to.pivotKm, 0, emptySample());
    expect(s.positionKm.distanceTo(new Vector3(7000 + 0.45, 0, 0))).toBeLessThan(1e-2);
  });

  // Radius is never LINEAR — that is the "nothing happens, then a slam" the
  // brief warns about. Half way through a 40,000 → 0.45 km flight the camera
  // must be nowhere near 20,000 km. The exact value depends on the approach
  // blend (blendRadiusKm); both ends of that parameter are pinned in
  // approach-blend.test.ts, so this asserts only the property they share.
  it('never interpolates radius linearly: at u=0.5 the 40,000→0.45 case is far closer than 20,000 km', () => {
    for (const blend of [0, APPROACH_BLEND, 1]) {
      const s = sampleFlightPath(
        { ...from, dir: new Vector3(1, 0, 0) }, // θ=0 so the swell term vanishes
        to,
        0.5,
        to.pivotKm,
        0,
        emptySample(),
        blend,
      );
      const radius = s.positionKm.distanceTo(s.pivotKm);
      expect(radius).toBeLessThan(200);
      expect(radius).toBeGreaterThan(0.45);
    }
  });

  // The blend's whole purpose, at the level sampleFlightPath sees it.
  it('a higher blend is already closer at the flight midpoint', () => {
    const radiusAt = (blend: number) => {
      const s = sampleFlightPath(
        { ...from, dir: new Vector3(1, 0, 0) },
        to,
        0.5,
        to.pivotKm,
        0,
        emptySample(),
        blend,
      );
      return s.positionKm.distanceTo(s.pivotKm);
    };
    expect(radiusAt(APPROACH_BLEND)).toBeLessThan(radiusAt(0));
  });

  it('the arc swell can only INCREASE radius (sin(π·u) ≥ 0), so a slerp+geomLerp path never dips below min(r0, r1)', () => {
    let minRadius = Infinity;
    for (let u = 0; u <= 1; u += 0.02) {
      const s = sampleFlightPath(from, to, u, to.pivotKm, 0.5, emptySample());
      minRadius = Math.min(minRadius, s.positionKm.distanceTo(s.pivotKm));
    }
    expect(minRadius).toBeGreaterThanOrEqual(0.45 - 1e-6);
  });

  it('blends refUp across the flight (no roll snap at arrival)', () => {
    const mid = sampleFlightPath(from, to, 0.5, to.pivotKm, 0, emptySample());
    expect(mid.refUp.length()).toBeCloseTo(1, 6);
    expect(mid.refUp.dot(from.refUp)).toBeGreaterThan(0);
    expect(mid.refUp.dot(to.refUp)).toBeGreaterThan(0);
  });

  it('writes into `out` and returns it', () => {
    const out = emptySample();
    expect(sampleFlightPath(from, to, 0.3, to.pivotKm, 0, out)).toBe(out);
  });
});

describe('angleBetweenDirs', () => {
  it('is 0 for identical dirs and π for opposite', () => {
    expect(angleBetweenDirs(new Vector3(1, 0, 0), new Vector3(1, 0, 0))).toBeCloseTo(0, 6);
    expect(angleBetweenDirs(new Vector3(1, 0, 0), new Vector3(-1, 0, 0))).toBeCloseTo(Math.PI, 6);
  });
});
