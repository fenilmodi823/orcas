function formatUtc(date: Date, nowMs?: number): string {
  const iso = date.toISOString();
  // The zone written out, as on every time in ORCAS (A.11).
  const time = `${iso.slice(11, 19)} UTC`;
  if (nowMs === undefined || iso.slice(0, 10) === new Date(nowMs).toISOString().slice(0, 10)) return time;
  return `${iso.slice(0, 10)} ${time}`;
}

function ageWords(ms: number): string {
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days} ${days === 1 ? 'day' : 'days'} old`;
  const hours = Math.max(1, Math.floor(ms / 3_600_000));
  return `${hours} ${hours === 1 ? 'hour' : 'hours'} old`;
}

/** "3 days ago" — the passes caption's form of the same age (Task 7). */
export function relativeDays(ms: number): string {
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  return 'today';
}

/** The header's epoch (Stage B §5.3): a label, the epoch as a measurement, and when stale its age in words. */
export function epochWords(epoch: Date, nowMs: number | undefined, stale: boolean): { label: string; value: string; age: string | null } {
  return {
    label: 'Elements as of',
    value: formatUtc(epoch, nowMs),
    age: stale && nowMs !== undefined ? ageWords(nowMs - epoch.getTime()) : null,
  };
}
