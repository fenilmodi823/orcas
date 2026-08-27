import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Flight, makeDeferred } from './flight.js';
import type { FlightEndpoint, FlightSample } from './flight-path.js';

const ep = (dir: Vector3, r: number, pivot: Vector3): FlightEndpoint => ({
  dir: dir.clone().normalize(),
  radiusKm: r,
  pivotKm: pivot.clone(),
  refUp: new Vector3(0, 0, 1),
});
const out = (): FlightSample => ({ positionKm: new Vector3(), pivotKm: new Vector3(), refUp: new Vector3() });

describe('makeDeferred', () => {
  it('resolve settles the promise', async () => {
    const d = makeDeferred();
    d.resolve();
    await expect(d.promise).resolves.toBeUndefined();
  });
});

describe('Flight', () => {
  const from = ep(new Vector3(0, 0, 1), 40000, new Vector3());
  const to = ep(new Vector3(1, 0, 0), 0.45, new Vector3(7000, 0, 0));

  it('sample at elapsed 0 is the `from` pose; at elapsed ≥ duration is `done` and near the `to` pose', () => {
    const f = new Flight(from, to, 2.0, 0);
    const s0 = f.sample(0, to.pivotKm, out());
    expect(s0.positionKm.distanceTo(new Vector3(0, 0, 40000))).toBeLessThan(1e-2);
    f.sample(2.0, to.pivotKm, out());
    expect(f.done).toBe(true);
    const s1 = f.sample(2.5, to.pivotKm, out());
    expect(s1.positionKm.distanceTo(new Vector3(7000 + 0.45, 0, 0))).toBeLessThan(1e-1);
  });

  it('elapsedFraction is clamped to [0, 1]', () => {
    const f = new Flight(from, to, 2.0, 0);
    f.sample(-1, to.pivotKm, out());
    expect(f.elapsedFraction).toBe(0);
    f.sample(99, to.pivotKm, out());
    expect(f.elapsedFraction).toBe(1);
  });

  it('cancel rejects the promise with CancelledError', async () => {
    const f = new Flight(from, to, 2.0, 0);
    f.cancel();
    await expect(f.promise).rejects.toMatchObject({ name: 'CancelledError' });
  });

  it('running the same flight at 30, 60 and 144 Hz lands within 1e-3 (brief §I test class 5)', () => {
    const run = (hz: number) => {
      const f = new Flight(from, to, 2.0, 0);
      const dt = 1 / hz;
      const s = out();
      for (let t = 0; t <= 2.0 + dt; t += dt) f.sample(t, to.pivotKm, s);
      return s.positionKm.clone();
    };
    expect(run(30).distanceTo(run(60))).toBeLessThan(1e-3);
    expect(run(60).distanceTo(run(144))).toBeLessThan(1e-3);
  });
});
