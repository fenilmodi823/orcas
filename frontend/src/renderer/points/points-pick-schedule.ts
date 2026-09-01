const MOVE_THRESHOLD_PX = 2; // brief §D.3
const DRAG_THRESHOLD_PX = 4; // brief §D.5

interface ShouldIssuePickInput {
  px: number;
  py: number;
  lastRequested: { px: number; py: number } | null;
  inFlight: boolean;
  suppressed: boolean;
}

/**
 * Brief §D.3's cadence rule as pure arithmetic: at most one pick per
 * frame (the caller enforces "per frame" by only calling this once per
 * rAF tick), only if the cursor moved past the threshold, never while a
 * previous pick's async readback hasn't resolved yet, never while
 * suppressed — a camera flight is playing, and use-camera-controller
 * publishes that through camera-status.ts.
 */
export function shouldIssuePick(input: ShouldIssuePickInput): boolean {
  if (input.suppressed || input.inFlight) return false;
  if (input.lastRequested === null) return true;
  const dx = input.px - input.lastRequested.px;
  const dy = input.py - input.lastRequested.py;
  return dx * dx + dy * dy > MOVE_THRESHOLD_PX * MOVE_THRESHOLD_PX;
}

/** Brief §D.5: "pick only if total drag < 4 px" — the getDraggedOffset().isZero() rule. */
export function isClickNotDrag(startPx: number, startPy: number, endPx: number, endPy: number): boolean {
  const dx = endPx - startPx;
  const dy = endPy - startPy;
  return dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX;
}
