import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';

const fmtKm = (km: number): string => (km >= 100 ? Math.round(km).toLocaleString() : km.toPrecision(3));

/**
 * Mirrors the per-frame numbers the renderer writes into refs — Tier 1
 * membership, active-set size, camera radius and camera-to-object distance —
 * into the debug panel.
 *
 * Written IMPERATIVELY from a rAF loop, the same contract ObjectTether uses,
 * rather than through React state on an interval. Two reasons, both learned
 * the hard way:
 *
 * 1. Rules.md bans per-frame `setState`, so a state-driven readout has to
 *    poll — and a 10 Hz poll under a loaded frame loop was observed
 *    delivering only three distinct values across 2.7 seconds. A camera
 *    instrument that lies about what the camera did is worse than no
 *    instrument.
 * 2. The `data-` attributes are the measurement surface used to tune the
 *    flight curve. They have to be exact, per frame.
 */
export function Tier1Readout({
  tier1CountRef,
  activeCountRef,
  radiusKmRef,
  targetDistanceKmRef,
}: {
  readonly tier1CountRef: MutableRefObject<number>;
  readonly activeCountRef: MutableRefObject<number>;
  /** Camera distance from its pivot. */
  readonly radiusKmRef?: MutableRefObject<number>;
  /** Camera distance to the target OBJECT — during a flight this is the one
   * that decides whether anything is visible, and it is NOT the radius. */
  readonly targetDistanceKmRef?: MutableRefObject<number>;
}) {
  const nodeRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const node = nodeRef.current;
      if (node) {
        const tier1 = tier1CountRef.current;
        const active = activeCountRef.current;
        const radiusKm = radiusKmRef?.current ?? 0;
        const targetKm = targetDistanceKmRef?.current ?? 0;
        node.dataset.radiusKm = String(radiusKm);
        node.dataset.targetKm = String(targetKm);
        node.textContent = `tier 1: ${tier1.toLocaleString()} · active: ${active.toLocaleString()}\nr ${fmtKm(radiusKm)} km · to target ${fmtKm(targetKm)} km`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [tier1CountRef, activeCountRef, radiusKmRef, targetDistanceKmRef]);

  return <p ref={nodeRef} className="points-debug__count points-debug__count--multiline" />;
}
