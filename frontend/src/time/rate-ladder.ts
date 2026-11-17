/**
 * NASA Eyes on the Solar System's time-rate ladder, in simulated seconds per
 * real second — read from its own `rate=` URL parameter while stepping ▶▶
 * on 2026-10-03 (Reference - NASA Eyes and LeoLabs §4.1). ◀◀ walks the same
 * ladder negative; zero is never a step, because pause is its own button.
 */
export const RATE_LADDER_S_PER_S: readonly number[] = [
  1, 3, 5, 6, 8, 10, 20, 30, 40, 50,
  60, 180, 300, 360, 480, 600, 1_200, 1_800, 2_400, 3_000,
  3_600, 10_800, 18_000, 21_600, 28_800, 36_000, 46_800, 57_600, 64_800, 75_600,
  86_400, 172_800, 259_200, 432_000, 518_400,
  604_800, 1_814_400,
  2_592_000, 5_184_000, 10_368_000, 15_552_000, 20_736_000, 25_920_000,
  31_536_000, 63_072_000, 94_608_000,
];

/** The ladder signed: −3 yr/s … −1, +1 … +3 yr/s. */
const SIGNED_LADDER: readonly number[] = [...RATE_LADDER_S_PER_S.map((r) => -r).reverse(), ...RATE_LADDER_S_PER_S];

/**
 * One ▶▶ (`direction` +1) or ◀◀ (−1) press from `signedRate`: the next rung
 * up or down the signed ladder, stopping at its ends. A rate that is not on
 * the ladder moves to its neighbour in that direction.
 */
export function stepRate(signedRate: number, direction: 1 | -1): number {
  if (direction > 0) return SIGNED_LADDER.find((r) => r > signedRate) ?? SIGNED_LADDER[SIGNED_LADDER.length - 1];
  for (let i = SIGNED_LADDER.length - 1; i >= 0; i--) if (SIGNED_LADDER[i] < signedRate) return SIGNED_LADDER[i];
  return SIGNED_LADDER[0];
}

/** NASA Eyes' units, as symbols: a 30-day month and a 365-day year, as its ladder uses. */
const UNITS: readonly (readonly [string, number])[] = [
  ['yr', 31_536_000],
  ['mo', 2_592_000],
  ['wk', 604_800],
  ['d', 86_400],
  ['h', 3_600],
  ['min', 60],
];

/**
 * The rate as words or a measurement (Stage B §5.6): "Real time" at 1 s/s,
 * otherwise the largest unit that divides it evenly, as a symbol: "1 min/s",
 * not "60 s/s"; "3 wk/s". Reverse rates carry a true minus sign.
 */
export function formatRate(signedRate: number): string {
  if (signedRate === 1) return 'Real time';
  const magnitude = Math.abs(signedRate);
  const [unit, size] = UNITS.find(([, s]) => magnitude >= s && magnitude % s === 0) ?? ['s', 1];
  return `${signedRate < 0 ? '−' : ''}${magnitude / size} ${unit}/s`;
}
