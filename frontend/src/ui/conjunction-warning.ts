import type { Conjunction, ConjunctionParty } from '../data/conjunction-client.js';

/** NASA CARA's mitigation threshold. Red means at or above it, nothing else (Design.md §3). */
export const NASA_PC_THRESHOLD = 1e-4;
/** Simulated notice at real speed (conjunction-alert spec §3.2). */
export const MIN_LEAD_MS = 10 * 60_000;
/** Real-time notice at any speed, so the message can be read and clicked (spec §3.2). */
export const LEAD_REAL_MS = 20_000;
/** Watch puts the clock this far before closest approach (spec §3.5). */
export const WATCH_LEAD_MS = 30_000;

export interface WarningPick {
  readonly conjunction: Conjunction;
  readonly phase: 'upcoming' | 'passed';
}

/** One encounter's identity across the top-10 and per-object lists. */
export function warningKey(c: Conjunction): string {
  return `${c.tcaMs}|${c.primary.noradId}|${c.secondary.noradId}`;
}

/**
 * The run's top 10 plus the selected object's passes, kept only at or above
 * NASA's line (a null maximum, outside 2D validity, never qualifies),
 * shown once if on both lists, in TCA order (spec §3.1).
 */
export function warningCandidates(top: readonly Conjunction[], selected: readonly Conjunction[]): Conjunction[] {
  const byKey = new Map<string, Conjunction>();
  for (const c of [...top, ...selected]) {
    if (c.maximumPc !== null && c.maximumPc >= NASA_PC_THRESHOLD) byKey.set(warningKey(c), c);
  }
  return [...byKey.values()].sort((a, b) => a.tcaMs - b.tcaMs);
}

/** Simulated ms of notice before TCA at a signed rate (simulated s per real s). */
export function leadMs(rate: number): number {
  return Math.max(MIN_LEAD_MS, LEAD_REAL_MS * Math.abs(rate));
}

export interface PickArgs {
  /** In TCA order, as `warningCandidates` returns them. */
  readonly candidates: readonly Conjunction[];
  /** Simulated time, ms. */
  readonly nowMs: number;
  /** Signed simulated seconds per real second; 0 while paused. */
  readonly rate: number;
  readonly dismissed: ReadonlySet<string>;
  /** The key on screen last time, or null. Only that pass can become "passed". */
  readonly shownKey: string | null;
}

/**
 * The one message to show (spec §3.2): the earliest undismissed pass due
 * within the lead; else the pass already on screen once it has passed.
 * Running backwards raises nothing new and keeps what is on screen.
 */
export function pickWarning({ candidates, nowMs, rate, dismissed, shownKey }: PickArgs): WarningPick | null {
  const live = candidates.filter((c) => !dismissed.has(warningKey(c)));
  const shown = shownKey === null ? undefined : live.find((c) => warningKey(c) === shownKey);
  if (rate >= 0) {
    const lead = leadMs(rate);
    const next = live.find((c) => c.tcaMs >= nowMs && c.tcaMs - nowMs <= lead);
    if (next) return { conjunction: next, phase: 'upcoming' };
    return shown && shown.tcaMs < nowMs ? { conjunction: shown, phase: 'passed' } : null;
  }
  return shown ? { conjunction: shown, phase: shown.tcaMs >= nowMs ? 'upcoming' : 'passed' } : null;
}

/** Watch follows the selected object if it is in the pair, otherwise the primary (spec §3.5). */
export function watchTarget(c: Conjunction, selectedNorad: string | null): { follow: ConjunctionParty; counterpart: ConjunctionParty } {
  return selectedNorad === c.secondary.noradId
    ? { follow: c.secondary, counterpart: c.primary }
    : { follow: c.primary, counterpart: c.secondary };
}
