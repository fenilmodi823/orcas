import { describe, expect, it } from 'vitest';
import { framingDistanceKm } from './framing.js';

describe('framingDistanceKm', () => {
  it('frames the ISS (~55 m across, R_extents ≈ 0.055 km) at ~0.45 km with a 35° FOV (brief §C.6)', () => {
    expect(framingDistanceKm(0.055, 35)).toBeCloseTo(0.45, 1);
  });

  it('clamps a tiny target no closer than R_extents · 1.8', () => {
    // A 1 m fleck at a wide k would compute closer than 1.8·R; clamp holds it.
    const r = 0.0005;
    expect(framingDistanceKm(r, 35, 0.01)).toBeCloseTo(r * 1.8, 6);
  });

  it('clamps a huge target no further than R_extents · 400', () => {
    const r = 100;
    expect(framingDistanceKm(r, 35, 100000)).toBeCloseTo(r * 400, 3);
  });

  it('scales linearly with the target size at a fixed FOV', () => {
    expect(framingDistanceKm(0.1, 35) / framingDistanceKm(0.05, 35)).toBeCloseTo(2, 6);
  });
});
