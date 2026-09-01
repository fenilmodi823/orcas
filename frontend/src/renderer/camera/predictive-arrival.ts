/**
 * ⚠️ CURRENTLY UNUSED BY PRODUCT CODE, retained deliberately (2026-09-01).
 *
 * FlightController used to call this every tick to re-solve the arrival
 * time. That was wrong for an in-flight retarget: the duration function it
 * iterates is floored at DUR_MIN, so the solved arrival never came closer
 * than ~1.2 s, which parked the camera ~9 km from a LEO target for the whole
 * flight and produced the "object appears out of nowhere" pop. An active
 * flight already knows its arrival time; it does not need solving.
 *
 * Kept, with its tests, because the fixed point IS the right tool for the
 * question it was written for — "how long will a flight to a moving target
 * take, given that the answer changes where it ends?" — which M1.7b/M1.9's
 * followOrbit mode will ask when choosing a duration up front. Delete it at
 * a phase boundary if that never materialises.
 */
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
