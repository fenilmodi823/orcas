import { Vector3 } from 'three';

const PICARD_ITERATIONS = 3;
const _p = new Vector3();

/**
 * Solve the arrival-time fixed point (brief §C.10). Arrival time depends on
 * distance; distance depends on where the target is at arrival:
 *
 *   t_arrive ← t_now + duration(|camPos − p_target(t_arrive)|)
 *
 * Three Picard iterations. Converges fast because `duration()` is
 * logarithmic in distance — a 10 % error in distance perturbs the duration
 * by ~0.03 s. Evaluating `p_target(t)` is one Hermite evaluation of a
 * segment the keyframe ring already holds (§A.5) — cheap.
 *
 * A 500 km LEO object travels 7.61 km/s; a 2 s flight covers 15.2 km of
 * target motion. Aim at where it is now and you arrive 15 km behind it —
 * with `r_frame ≈ 0.45 km` the target is not merely off-centre, it is off
 * screen.
 */
export function solveArrivalTimeMs(
  camPosKm: Vector3,
  targetPosAtMs: (epochMs: number, out: Vector3) => Vector3,
  tNowMs: number,
  durationSecForDistance: (distKm: number) => number,
): number {
  let t = tNowMs;
  for (let i = 0; i < PICARD_ITERATIONS; i++) {
    targetPosAtMs(t, _p);
    t = tNowMs + durationSecForDistance(camPosKm.distanceTo(_p)) * 1000;
  }
  return t;
}
