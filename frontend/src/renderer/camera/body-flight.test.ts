import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import type { FlightSample } from './flight-path.js';
import { arrivalDistanceKm, BodyFlight, swingDurationSec, TRAVEL_SEC } from './body-flight.js';

const sample = (): FlightSample => ({ positionKm: new Vector3(), pivotKm: new Vector3(), refUp: new Vector3() });
const JUPITER = new Vector3(6e8, 0, 0);
const DT = 1 / 60;

function flight(swingOffsetKm: Vector3 | null) {
  return new BodyFlight({
    startPositionKm: new Vector3(0, -24_000, 0),
    startPivotKm: new Vector3(0, 0, 0),
    startRefUp: new Vector3(0, 0, 1),
    arrivalOffsetKm: new Vector3(-300_000, 0, 0),
    swingOffsetKm,
    endRefUp: new Vector3(0, 0.4, 0.9).normalize(),
  });
}

describe('arrivalDistanceKm (Reference §4.5)', () => {
  it('reproduces NASA Eyes’ measured 273,817 km from Jupiter at NASA’s own field of view', () => {
    // NASA: 60° horizontal at 1440 × 900, so 39.68° vertical.
    const fovV = (2 * Math.atan(Math.tan(Math.PI / 6) * (900 / 1440)) * 180) / Math.PI;
    expect(arrivalDistanceKm(71_492, fovV) / 273_817).toBeCloseTo(1, 3);
  });

  it('fills the same 75 % of the frame height at ORCAS’s narrower field of view', () => {
    const r = 6378.1366;
    const d = arrivalDistanceKm(r, 35);
    const fraction = Math.tan(Math.asin(r / d)) / Math.tan((17.5 * Math.PI) / 180);
    expect(fraction).toBeCloseTo(0.75, 2);
  });
});

describe('swingDurationSec', () => {
  it('is NASA’s 0.75 s scaled by how far the camera has to move, never under 0.15 s', () => {
    const a = new Vector3(100, 0, 0);
    expect(swingDurationSec(a, a)).toBe(0.15);
    expect(swingDurationSec(a, new Vector3(-100, 0, 0))).toBe(0.75);
    expect(swingDurationSec(a, new Vector3(100, 50, 0))).toBeCloseTo(0.375, 9);
  });
});

describe('BodyFlight', () => {
  it('travels in a straight line at constant speed, as NASA’s linear transition does', () => {
    const f = flight(null);
    const out = sample();
    const points: Vector3[] = [];
    for (let i = 0; i < 9; i++) {
      f.tick(i === 0 ? 0 : TRAVEL_SEC / 8, JUPITER, out);
      points.push(out.positionKm.clone());
    }
    const steps = points.slice(1).map((p, i) => p.distanceTo(points[i] ?? p));
    for (const s of steps) expect(s / (steps[0] ?? 1)).toBeCloseTo(1, 6);
    const dir = (points[8] ?? new Vector3()).clone().sub(points[0] ?? new Vector3()).normalize();
    const mid = (points[4] ?? new Vector3()).clone().sub(points[0] ?? new Vector3()).normalize();
    expect(dir.dot(mid)).toBeCloseTo(1, 9);
  });

  it('arrives at the body plus the arrival offset, looking at the body, with its pole up', () => {
    const f = flight(null);
    const out = sample();
    let done = false;
    for (let t = 0; t < 2 && !done; t += DT) done = f.tick(DT, JUPITER, out);
    expect(done).toBe(true);
    expect(out.positionKm.distanceTo(new Vector3(6e8 - 300_000, 0, 0))).toBeLessThan(1e-3);
    expect(out.pivotKm.distanceTo(JUPITER)).toBeLessThan(1e-3);
    expect(out.refUp.y).toBeCloseTo(new Vector3(0, 0.4, 0.9).normalize().y, 9);
  });

  it('swings to the lit side on an arc, never nearer the body than the arrival distance', () => {
    const f = flight(new Vector3(0, 300_000, 0));
    const out = sample();
    let minKm = Infinity;
    let elapsed = 0;
    let done = false;
    while (!done && elapsed < 3) {
      done = f.tick(DT, JUPITER, out);
      elapsed += DT;
      if (elapsed > TRAVEL_SEC + DT) minKm = Math.min(minKm, out.positionKm.distanceTo(JUPITER));
    }
    expect(done).toBe(true);
    expect(minKm).toBeGreaterThan(300_000 * 0.999);
    expect(out.positionKm.distanceTo(new Vector3(6e8, 300_000, 0))).toBeLessThan(1e-3);
    expect(elapsed).toBeGreaterThan(TRAVEL_SEC + 0.5); // a 90° swing takes 0.75·√2 → capped at 0.75 s
  });

  it('turns the view smoothly even when the body is straight behind the camera', () => {
    const f = new BodyFlight({
      startPositionKm: new Vector3(1000, 0, 0),
      startPivotKm: new Vector3(2000, 0, 0), // looking +x, the body is at −x
      startRefUp: new Vector3(0, 0, 1),
      arrivalOffsetKm: new Vector3(10_000, 0, 0),
      swingOffsetKm: null,
      endRefUp: new Vector3(0, 0, 1),
    });
    const out = sample();
    const body = new Vector3(-1e8, 0, 0);
    let prev: Vector3 | null = null;
    for (let i = 0; i < 45; i++) {
      f.tick(DT, body, out);
      const look = out.pivotKm.clone().sub(out.positionKm).normalize();
      expect(Number.isFinite(look.x)).toBe(true);
      if (prev) expect(look.angleTo(prev)).toBeLessThan(0.2);
      prev = look;
    }
  });
});
