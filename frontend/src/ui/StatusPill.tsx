import './StatusPill.css';

export interface StatusPillProps {
  epoch: Date;
  stale?: boolean;
  /** When given, the date is shown as well whenever the epoch is not on the
   * same UTC day. A time of day alone reads as *today*, so a three-day-old
   * epoch shown as "14:50:11Z" presents stale data as live. Passed in rather
   * than read from the clock here, which keeps rendering pure. */
  nowMs?: number;
}

function formatUtc(date: Date, nowMs?: number): string {
  const iso = date.toISOString();
  const time = `${iso.slice(11, 19)}Z`;
  if (nowMs === undefined || iso.slice(0, 10) === new Date(nowMs).toISOString().slice(0, 10)) return time;
  return `${iso.slice(0, 10)} ${time}`;
}

/**
 * Data epoch and freshness. Always visible somewhere — an honesty
 * requirement (Rules.md §7), not a design one: never present a propagated
 * position as live truth without showing when it was true.
 */
export function StatusPill({ epoch, stale = false, nowMs }: StatusPillProps) {
  const value = formatUtc(epoch, nowMs);
  return (
    <div
      className="status-pill"
      data-stale={stale ? '' : undefined}
      role="status"
      aria-label={stale ? `Data stale, element set epoch ${value}` : `Element set epoch ${value}`}
    >
      <span className="status-pill__dot" aria-hidden />
      <span className="status-pill__label" aria-hidden>
        {stale ? 'stale' : 'epoch'}
      </span>
      <span className="status-pill__value" aria-hidden>
        {value}
      </span>
    </div>
  );
}
