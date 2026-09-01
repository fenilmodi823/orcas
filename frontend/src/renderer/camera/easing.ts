export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/** Hermite 0→1 ramp with zero first derivative at both edges. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Perlin's smootherstep — zero FIRST AND SECOND derivative at both ends.
 * The 2nd-derivative-zero property removes the faint "click" you feel at
 * the start and end of a plain cubic ease (brief §C.4).
 */
export function smootherstep(s: number): number {
  const c = clamp(s, 0, 1);
  return c * c * c * (c * (c * 6 - 15) + 10);
}

/**
 * The focus-flight curve: smootherstep with an asymmetric bias. `gamma < 1`
 * (default 0.82) spends more of the timeline in the settle — the long tail is what reads as "expensive" (brief §C.4). A
 * symmetric ease arrives too abruptly.
 */
export function flightEase(s: number, gamma = 0.82): number {
  return smootherstep(Math.pow(clamp(s, 0, 1), gamma));
}

/**
 * Half-life exponential decay. Frame-rate independent: `halfLifeSec` is a
 * real device-independent unit, unlike `x += (target−x)·0.1` which behaves
 * differently at 60 Hz, 120 Hz and during a hitch (brief §C.12).
 */
export function damp(current: number, target: number, halfLifeSec: number, dtSec: number): number {
  if (halfLifeSec <= 0) return target;
  const k = 1 - Math.pow(2, -dtSec / halfLifeSec);
  return current + (target - current) * k;
}

/**
 * Critically-damped spring (Game Programming Gems 4, ch. 1.10). No
 * overshoot; frame-rate independent; because the velocity term persists it
 * LEADS a constant-velocity target rather than lagging it — exactly the
 * behaviour wanted when following something in orbit (brief §C.10). `vel`
 * is mutated in place — pass a stable `{ value }` ref, one per tracked
 * quantity.
 */
export function smoothDamp(
  current: number,
  target: number,
  vel: { value: number },
  smoothTimeSec: number,
  dtSec: number,
): number {
  const omega = 2 / Math.max(1e-4, smoothTimeSec);
  const x = omega * dtSec;
  const expo = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x); // ≈ exp(−x), cheap
  const change = current - target;
  const temp = (vel.value + omega * change) * dtSec;
  vel.value = (vel.value - omega * temp) * expo;
  return target + (change + temp) * expo;
}
