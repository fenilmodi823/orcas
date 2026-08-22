/** A 3D vector. Unit is whatever the caller's endpoints use (this module
 * is unit-agnostic — segment-builder.ts is where km/km-per-s is fixed). */
export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface HermiteEndpoint {
  readonly position: Vec3;
  readonly velocity: Vec3;
}

const AXES = ['x', 'y', 'z'] as const;

/**
 * Cubic Hermite interpolation of position and velocity between two state
 * vectors (position + velocity at each endpoint — exactly what SGP4
 * returns per call). Input: endpoints at t0/t1, hSeconds = t1 - t0,
 * s = (t - t0) / hSeconds in [0, 1]. Output: position (same unit as the
 * endpoints) and velocity (that unit per second) at t.
 *
 * Velocity is the analytic derivative of the same basis functions used
 * for position, so position and velocity stay consistent to machine
 * precision at every instant — see ORCAS Vault Phase-4 Engineering Brief
 * §A.5.
 */
export function hermiteState(
  p0: HermiteEndpoint,
  p1: HermiteEndpoint,
  hSeconds: number,
  s: number,
): HermiteEndpoint {
  const s2 = s * s;
  const s3 = s2 * s;

  const h00 = 2 * s3 - 3 * s2 + 1;
  const h10 = s3 - 2 * s2 + s;
  const h01 = -2 * s3 + 3 * s2;
  const h11 = s3 - s2;

  const h00d = 6 * s2 - 6 * s;
  const h10d = 3 * s2 - 4 * s + 1;
  const h01d = -6 * s2 + 6 * s;
  const h11d = 3 * s2 - 2 * s;

  const position: Record<string, number> = {};
  const velocity: Record<string, number> = {};

  for (const axis of AXES) {
    position[axis] =
      h00 * p0.position[axis] +
      h10 * hSeconds * p0.velocity[axis] +
      h01 * p1.position[axis] +
      h11 * hSeconds * p1.velocity[axis];

    velocity[axis] =
      (h00d * p0.position[axis] +
        h10d * hSeconds * p0.velocity[axis] +
        h01d * p1.position[axis] +
        h11d * hSeconds * p1.velocity[axis]) /
      hSeconds;
  }

  return {
    position: position as unknown as Vec3,
    velocity: velocity as unknown as Vec3,
  };
}
