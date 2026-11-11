import { useReducedMotion } from '../state/use-reduced-motion.js';
import { epochWords } from './epoch-words.js';
import './StatusPill.css';

export interface StatusPillProps {
  epoch: Date;
  stale?: boolean;
  /** When given, the date is shown as well whenever the epoch is not on the
   * same UTC day. A time of day alone reads as *today*, so a three-day-old
   * epoch shown as "14:50:11 UTC" presents stale data as live. Passed in rather
   * than read from the clock here, which keeps rendering pure. */
  nowMs?: number;
}

/**
 * Data epoch and freshness, in words (Stage B §5.3). Always visible somewhere —
 * an honesty requirement (Rules.md §7), not a design one: never present a
 * propagated position as live truth without showing when it was true.
 */
export function StatusPill({ epoch, stale = false, nowMs }: StatusPillProps) {
  const { label, value, age } = epochWords(epoch, nowMs, stale);
  const reducedMotion = useReducedMotion();
  return (
    <div
      className="status-pill"
      data-stale={stale ? '' : undefined}
      data-reduced-motion={reducedMotion ? '' : undefined}
      role="status"
      aria-label={`${label} ${value}${age ? `, ${age}` : ''}`}
    >
      <span className="status-pill__label" aria-hidden>{label}</span>{' '}
      <span className="status-pill__value" aria-hidden>{value}</span>
      {age && <span className="status-pill__age" aria-hidden>, {age}</span>}
    </div>
  );
}
