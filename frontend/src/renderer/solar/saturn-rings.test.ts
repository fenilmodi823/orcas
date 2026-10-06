import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { RING_INNER_KM, RING_OUTER_KM, ringDistanceKm } from './saturn-rings.js';

describe('ringDistanceKm (S5b)', () => {
  const saturn = new Vector3(1e9, 0, 0);
  const pole = new Vector3(0, 0, 1);
  const at = (x: number, z: number) => new Vector3(1e9 + x, 0, z);

  it('is the height above the ring plane over the rings', () => {
    expect(ringDistanceKm(at(100_000, 2_500), saturn, pole)).toBeCloseTo(2_500, 6);
  });

  it('is the distance to the nearer edge inside or outside the annulus', () => {
    expect(ringDistanceKm(at(RING_INNER_KM - 3_000, 4_000), saturn, pole)).toBeCloseTo(5_000, 6);
    expect(ringDistanceKm(at(RING_OUTER_KM + 6_000, -8_000), saturn, pole)).toBeCloseTo(10_000, 6);
  });
});
