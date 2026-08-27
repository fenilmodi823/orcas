import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { solveArrivalTimeMs } from './predictive-arrival.js';

describe('solveArrivalTimeMs', () => {
  it('for a stationary target, arrival = now + duration(distance-to-target)', () => {
    const cam = new Vector3(40000, 0, 0);
    const targetAt = (_t: number, out: Vector3) => out.set(0, 0, 0);
    const duration = (d: number) => 0.55 + 0.075 * Math.log2(Math.max(1, d));
    const t = solveArrivalTimeMs(cam, targetAt, 1_000_000, duration);
    expect(t).toBeCloseTo(1_000_000 + duration(40000) * 1000, 0);
  });

  it('accounts for a fast LEO target that moves ~15 km during a ~2 s flight (brief §C.10)', () => {
    const cam = new Vector3(0, 0, 42000);
    const speedKmPerMs = 7.61 / 1000;
    const targetAt = (t: number, out: Vector3) => out.set(0, speedKmPerMs * t, 7000);
    const duration = () => 2.0; // fixed 2 s for this check
    const tArrive = solveArrivalTimeMs(cam, targetAt, 0, duration);
    expect(tArrive).toBeCloseTo(2000, -1);
    const arrivalPos = targetAt(tArrive, new Vector3());
    expect(arrivalPos.y).toBeGreaterThan(14);
    expect(arrivalPos.y).toBeLessThan(17);
  });

  it('converges: iterations 2 and 3 differ by well under a frame (16 ms)', () => {
    const cam = new Vector3(30000, 10000, 0);
    const speed = 7 / 1000;
    const targetAt = (t: number, out: Vector3) => out.set(6800, speed * t, 0);
    const duration = (d: number) => 0.55 + 0.075 * Math.log2(Math.max(1, d)) + 0.4;

    const iterates: number[] = [];
    let t = 0;
    for (let i = 0; i < 3; i++) {
      const p = targetAt(t, new Vector3());
      t = 0 + duration(cam.distanceTo(p)) * 1000;
      iterates.push(t);
    }
    expect(Math.abs(iterates[2] - iterates[1])).toBeLessThan(16);
  });
});
