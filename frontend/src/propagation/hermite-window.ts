import type { HermiteEndpoint, Vec3 } from './hermite.js';

const AXES = ['x', 'y', 'z'] as const;

/**
 * Hermite interpolation through W states, as NASA's SPK type 13 does: the
 * polynomial of degree 2W - 1 that matches each state's position and velocity.
 * W = 2 gives exactly the satellites' cubic (`hermiteState`); W = 4 follows a
 * fast, tightly curving orbit far better from the same samples (S6a, B.27).
 * Mirrors `scripts/data/horizons_hermite.py`.
 *
 * Input: node times (any unit), positions, velocities in position units per
 * time unit, and t in the same time unit. Output: position and velocity at t.
 * Newton divided differences with each node repeated, then Horner for the
 * value and its derivative.
 */
export function hermiteWindow(
  times: readonly number[],
  positions: readonly Vec3[],
  velocities: readonly Vec3[],
  t: number,
): HermiteEndpoint {
  const n = times.length * 2;
  const z = times.flatMap((time) => [time, time]);
  const position: Record<string, number> = {};
  const velocity: Record<string, number> = {};
  for (const axis of AXES) {
    const d = positions.flatMap((p) => [p[axis], p[axis]]);
    for (let order = 1; order < n; order++) {
      for (let i = n - 1; i >= order; i--) {
        const zi = z[i] ?? NaN;
        const zj = z[i - order] ?? NaN;
        // A repeated node's first difference is its velocity.
        d[i] = order === 1 && zi === zj ? (velocities[i >> 1]?.[axis] ?? NaN) : ((d[i] ?? NaN) - (d[i - 1] ?? NaN)) / (zi - zj);
      }
    }
    let p = d[n - 1] ?? NaN;
    let dp = 0;
    for (let k = n - 2; k >= 0; k--) {
      const dt = t - (z[k] ?? NaN);
      dp = dp * dt + p;
      p = p * dt + (d[k] ?? NaN);
    }
    position[axis] = p;
    velocity[axis] = dp;
  }
  return {
    position: { x: position.x ?? NaN, y: position.y ?? NaN, z: position.z ?? NaN },
    velocity: { x: velocity.x ?? NaN, y: velocity.y ?? NaN, z: velocity.z ?? NaN },
  };
}

/** The first keyframe of the window for interval k of `count` keyframes. Same rule as the bake. */
export function windowStart(k: number, window: number, count: number): number {
  return Math.min(Math.max(k - Math.floor(window / 2) + 1, 0), count - window);
}
