import { useCallback, useEffect } from 'react';
import { useSimulationStore } from '../state/simulation-store.js';
import { rangeLimit, rangeLimitNotice, type TimeRange } from './coverage.js';

/** How long the "stopped at the edge" line stays up. */
const NOTICE_MS = 6_000;

/**
 * NASA Eyes stops its clock at its bounds, auto-pausing with a message
 * (Reference - NASA Eyes §4.1). This does the same at the edge of ORCAS's
 * data, the union of every element set's coverage: playback that crosses it
 * is paused and pulled back to the edge, and a typed time outside it is
 * clamped to the edge. Either way the dock says where it stopped and why.
 *
 * Checked on the dock's 4 Hz tick, so playback can overshoot by a quarter
 * second of simulated time before being pulled back to the edge.
 */
export function useEdgeStop(
  epochMs: number,
  playing: boolean,
  range: TimeRange | null,
  scrubTo: (epochMs: number) => void,
): { notice: string | null; jumpTo: (epochMs: number) => void } {
  const notice = useSimulationStore((s) => s.edgeNotice);
  const setNotice = useSimulationStore((s) => s.setEdgeNotice);

  useEffect(() => {
    if (!playing || !range) return;
    const limit = rangeLimit(epochMs, range);
    if (!limit) return;
    useSimulationStore.getState().pause();
    scrubTo(limit.boundMs);
    setNotice(rangeLimitNotice(limit));
  }, [epochMs, playing, range, scrubTo, setNotice]);

  useEffect(() => {
    if (notice === null) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice, setNotice]);

  const jumpTo = useCallback(
    (targetMs: number) => {
      const limit = range ? rangeLimit(targetMs, range) : null;
      useSimulationStore.getState().pause(); // also leaves live
      scrubTo(limit ? limit.boundMs : targetMs);
      setNotice(limit ? rangeLimitNotice(limit) : null);
    },
    [range, scrubTo, setNotice],
  );

  return { notice, jumpTo };
}
