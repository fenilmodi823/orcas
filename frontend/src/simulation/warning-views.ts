import type { Conjunction, ScreeningRun } from '../data/conjunction-client.js';
import { WATCH_LEAD_MS, watchTarget } from '../ui/conjunction-warning.js';
import type { PendingView } from './use-pending-view.js';

/** Watch: 30 s before closest approach, real speed, following the selected party (spec §3.5). */
export function watchView(c: Conjunction, selectedNorad: string | null): PendingView {
  return { selected: watchTarget(c, selectedNorad).follow.noradId, epochMs: c.tcaMs - WATCH_LEAD_MS, rate: 1, paused: false };
}

/** Go there: the screened window's start, keeping a forward rate, selection untouched (spec §3.3). */
export function goThereView(run: ScreeningRun, rate: number): PendingView {
  return { selected: null, epochMs: run.windowStartMs, rate: rate > 0 ? rate : 1, paused: false };
}
