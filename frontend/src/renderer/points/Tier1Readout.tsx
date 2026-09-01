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
  radiusKmRef,
}: {
  readonly tier1CountRef: MutableRefObject<number>;
  readonly activeCountRef: MutableRefObject<number>;
  /** Camera distance from its pivot. Shown here because the flight curve
   * cannot be tuned without watching the number it shapes. */
  readonly radiusKmRef?: MutableRefObject<number>;
}) {
  const [counts, setCounts] = useState({ tier1: 0, active: 0, radiusKm: 0 });

  useEffect(() => {
    const interval = setInterval(
      () =>
        setCounts({
          tier1: tier1CountRef.current,
          active: activeCountRef.current,
          radiusKm: radiusKmRef?.current ?? 0,
        }),
      POLL_MS,
    );
    return () => clearInterval(interval);
  }, [tier1CountRef, activeCountRef, radiusKmRef]);

  return (
    <p className="points-debug__count" data-radius-km={counts.radiusKm}>
      tier 1: {counts.tier1.toLocaleString()} · active: {counts.active.toLocaleString()} · r{' '}
      {counts.radiusKm >= 100 ? Math.round(counts.radiusKm).toLocaleString() : counts.radiusKm.toPrecision(3)} km
    </p>
  );
}
