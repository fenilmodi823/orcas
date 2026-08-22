/** Segments rebuild at least this many times per wall-clock second, to
 * bound worst-case CPU cost — see brief §A.5 "Choosing h at runtime". */
const TICKS_PER_WALL_SEC = 4;

/**
 * Choose the Hermite segment step h, in simulation seconds, for one
 * object. Balances interpolation accuracy (small h) against rebuild
 * cost (large h): h = max(h_accuracy, h_budget), then tightened for
 * eccentric orbits, where angular rate peaks at perigee well above the
 * mean rate — using the mean rate alone under-samples perigee.
 *
 * Input: meanMotionRevPerDay (OMM MEAN_MOTION field), eccentricity
 * (dimensionless, OMM ECCENTRICITY), timeRate (dimensionless simulation
 * speed multiplier, e.g. 3600 for "1 hour per wall second"). Output:
 * step size in simulation seconds.
 */
export function chooseStepSeconds(
  meanMotionRevPerDay: number,
  eccentricity: number,
  timeRate: number,
): number {
  const periodMin = 1440 / meanMotionRevPerDay;
  const hAccuracySec = (periodMin * 60) / 180;
  const hBudgetSec = Math.abs(timeRate) / TICKS_PER_WALL_SEC;
  const hBase = Math.max(hAccuracySec, hBudgetSec);

  // Perigee angular rate / mean rate = sqrt(1+e) / (1-e)^1.5 (brief §A.5).
  const perigeeRateRatio = Math.sqrt(1 + eccentricity) / Math.pow(1 - eccentricity, 1.5);
  return hBase / perigeeRateRatio;
}
