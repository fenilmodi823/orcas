import { useEffect, useState } from 'react';
import type { SimulationLoopHandle } from './use-simulation-loop.js';

/**
 * The simulation's current instant, sampled for display at a slow cadence.
 *
 * The clock itself advances every frame inside the loop, in refs. Reading it
 * into React state every frame is the banned pattern (Rules.md: "never update
 * React state every frame"), so this polls the frame state a few times a
 * second — plenty for a readout in HH:MM:SS, and it confines the re-render to
 * whichever small component calls this, never the scene.
 */
export function useSimulationClock(
  /** Until the first sample lands (a quarter-second at most) the clock reads
   * the loop's own start epoch, so a replay remount never shows today. */
  loop: Pick<SimulationLoopHandle, 'frameStateRef' | 'startEpochMs'>,
  hz = 4,
): Date {
  const { frameStateRef, startEpochMs } = loop;
  const [epochMs, setEpochMs] = useState<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      const next = frameStateRef.current.epochMs;
      // 0 means the loop has not evaluated a frame yet; keep the last value.
      if (next) setEpochMs(next);
    }, 1000 / hz);
    return () => clearInterval(timer);
  }, [frameStateRef, hz]);

  return new Date(epochMs ?? startEpochMs);
}
