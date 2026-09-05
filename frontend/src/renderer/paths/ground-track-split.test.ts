import { describe, expect, it } from 'vitest';
import { toGroundTrackSegments } from './ground-track-split.js';

describe('toGroundTrackSegments', () => {
  it('turns N points into N-1 segments when no sample crosses the branch cut', () => {
    const positions = new Float32Array([0, 0, 0, 1, 1, 1, 2, 2, 2]);
    const azimuthsRad = new Float32Array([-1, -0.5, 0]); // small, monotonic steps
    const { buffer, segmentCount } = toGroundTrackSegments(positions, azimuthsRad, 3);
    expect(segmentCount).toBe(2);
    expect([...buffer.subarray(0, 12)]).toEqual([0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2]);
  });

  it('skips exactly the pair that crosses the antimeridian', () => {
    // Three samples: a normal small step, then a wraparound from just
    // under +pi to just over -pi (a real ~2 deg step misrepresented by
    // atan2 as a ~358 deg jump).
    const positions = new Float32Array([0, 0, 0, 1, 1, 1, 2, 2, 2]);
    const azimuthsRad = new Float32Array([3.0, 3.13, -3.13]);
    const { segmentCount, buffer } = toGroundTrackSegments(positions, azimuthsRad, 3);
    expect(segmentCount).toBe(1); // only the first pair (3.0 -> 3.13) survives
    expect([...buffer.subarray(0, 6)]).toEqual([0, 0, 0, 1, 1, 1]);
  });

  it('produces zero segments when every pair wraps', () => {
    const positions = new Float32Array([0, 0, 0, 1, 1, 1]);
    const azimuthsRad = new Float32Array([3.14, -3.14]);
    const { segmentCount } = toGroundTrackSegments(positions, azimuthsRad, 2);
    expect(segmentCount).toBe(0);
  });

  it('refuses a buffer too small for the worst-case segment count', () => {
    const positions = new Float32Array(9);
    const azimuthsRad = new Float32Array([0, 0.1, 0.2]);
    expect(() => toGroundTrackSegments(positions, azimuthsRad, 3, new Float32Array(6))).toThrow(RangeError);
  });
});
