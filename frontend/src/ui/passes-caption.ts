import { screenedAgo } from './conjunction-warning-text.js';

const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const stamp = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');

/** "10 close passes, screened 3–4 Nov 2026": the collapsed list in one line (Stage B §5.5). */
export function passesSummary(count: number, windowStartMs: number, windowEndMs: number): string {
  const a = dayMonth.format(windowStartMs);
  const b = dayMonth.format(windowEndMs);
  const year = new Date(windowEndMs).getUTCFullYear();
  const startYear = new Date(windowStartMs).getUTCFullYear();
  const [aDay, aMonth] = a.split(' ');
  const [bDay, bMonth] = b.split(' ');
  const span =
    a === b ? `${a} ${year}`
    : startYear !== year ? `${a} ${startYear} – ${b} ${year}`
    : aMonth === bMonth ? `${aDay}–${bDay} ${bMonth} ${year}`
    : `${a} – ${b} ${year}`;
  return `${count} close ${count === 1 ? 'pass' : 'passes'}, screened ${span}`;
}

/** The screened window in full, with how long ago the run completed (as the quiet line counts it), in words. */
export function screenedCaption(windowStartMs: number, windowEndMs: number, completedAtMs: number, wallNowMs: number): string {
  return `Screened ${stamp(windowStartMs)} to ${stamp(windowEndMs)} UTC, ${screenedAgo(completedAtMs, wallNowMs)}.`;
}
