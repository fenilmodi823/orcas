import './StatusPill.css';

export interface StatusPillProps {
  epoch: Date;
  stale?: boolean;
}

function formatUtc(date: Date): string {
  return `${date.toISOString().slice(11, 19)}Z`;
}

/**
 * Data epoch and freshness. Always visible somewhere — an honesty
 * requirement (Rules.md §7), not a design one: never present a propagated
 * position as live truth without showing when it was true.
 */
export function StatusPill({ epoch, stale = false }: StatusPillProps) {
  const value = formatUtc(epoch);
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
