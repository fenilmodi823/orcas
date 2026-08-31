import { useEffect, useState } from 'react';
import type { MutableRefObject } from 'react';

const POLL_MS = 100; // the route's existing ≤10Hz UI-mirror cadence

/**
 * Mirrors the two per-frame counts Tier 1 writes into refs — membership
 * and active-set size — into the debug panel.
 *
 * Its own component, and its own 10 Hz poll, precisely because the counts
 * live in refs: turning them into React state inside the frame loop would
 * be the per-frame `setState` the conventions ban outright.
 */
export function Tier1Readout({
  tier1CountRef,
  activeCountRef,
}: {
  readonly tier1CountRef: MutableRefObject<number>;
  readonly activeCountRef: MutableRefObject<number>;
}) {
  const [counts, setCounts] = useState({ tier1: 0, active: 0 });

  useEffect(() => {
    const interval = setInterval(
      () => setCounts({ tier1: tier1CountRef.current, active: activeCountRef.current }),
      POLL_MS,
    );
    return () => clearInterval(interval);
  }, [tier1CountRef, activeCountRef]);

  return (
    <p className="points-debug__count">
      tier 1: {counts.tier1.toLocaleString()} · active: {counts.active.toLocaleString()}
    </p>
  );
}
